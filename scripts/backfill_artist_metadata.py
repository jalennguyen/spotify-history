"""Backfill artist metadata for existing artists in the database.

This script identifies artists in staging.artists that are missing metadata
(image_url, genres, popularity) and fetches it from Spotify API.

Usage:
    python scripts/backfill_artist_metadata.py
    python scripts/backfill_artist_metadata.py --dry-run  # Preview what would be updated
"""

from __future__ import annotations

import argparse
import os
import sys
from typing import TYPE_CHECKING

import spotipy
from spotipy.oauth2 import SpotifyOAuth
from dotenv import load_dotenv
import psycopg
from psycopg import sql

import supabase_store

load_dotenv()


def create_spotify_client() -> spotipy.Spotify:
    """Create Spotify client for API requests."""
    client_id = os.getenv("SPOTIFY_CLIENT_ID")
    client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")
    redirect_uri = os.getenv("SPOTIFY_REDIRECT_URI")

    if not all([client_id, client_secret, redirect_uri]):
        sys.stderr.write("Error: Missing Spotify credentials in environment variables.\n")
        sys.exit(1)

    auth_manager = SpotifyOAuth(
        scope="user-read-recently-played",
        client_id=client_id,
        client_secret=client_secret,
        redirect_uri=redirect_uri,
    )
    return spotipy.Spotify(auth_manager=auth_manager)


def get_artists_missing_metadata(cursor: psycopg.Cursor, schema: str) -> list[str]:
    """Get artist IDs that are missing metadata from the artists table."""
    query = sql.SQL("""
        SELECT artist_id 
        FROM {schema}.artists
        WHERE image_url IS NULL 
           OR genres IS NULL 
           OR popularity IS NULL
        ORDER BY first_seen_at DESC
    """).format(schema=sql.Identifier(schema))
    cursor.execute(query)
    return [row[0] for row in cursor.fetchall()]


def get_artists_from_listening_history(cursor: psycopg.Cursor, staging_schema: str) -> list[tuple[str, str]]:
    """Extract first artist name and ID from old listening history.
    
    Returns list of (artist_name, artist_id) tuples from raw_history JSON.
    Only gets the first artist from each track.
    """
    # Use raw SQL string since this query doesn't have dynamic schema/table names
    query = """
        WITH tracks AS (
            SELECT 
                jsonb_array_elements(payload -> 'items') as item
            FROM raw.raw_history
        ),
        first_artists AS (
            SELECT DISTINCT
                (item -> 'track' -> 'artists' -> 0 ->> 'name') as artist_name,
                (item -> 'track' -> 'artists' -> 0 ->> 'id') as artist_id
            FROM tracks
            WHERE item -> 'track' -> 'artists' IS NOT NULL
              AND jsonb_array_length(item -> 'track' -> 'artists') > 0
        )
        SELECT DISTINCT 
            artist_name,
            artist_id
        FROM first_artists
        WHERE artist_id IS NOT NULL
          AND artist_name IS NOT NULL
        ORDER BY artist_name
    """
    # Use execute with prepare=False to avoid prepared statement caching issues
    cursor.execute(query, prepare=False)
    return [(row[0], row[1]) for row in cursor.fetchall()]


def get_existing_artist_ids_and_names(cursor: psycopg.Cursor, schema: str) -> dict[str, str]:
    """Get existing artist IDs and names as a dict (id -> name)."""
    query = sql.SQL("SELECT artist_id, artist_name FROM {schema}.artists").format(
        schema=sql.Identifier(schema)
    )
    cursor.execute(query)
    return {row[0]: row[1] for row in cursor.fetchall()}


def backfill_artists(dry_run: bool = False) -> None:
    """Backfill metadata for artists missing it."""
    if not supabase_store.is_configured():
        sys.stderr.write("Error: Supabase configuration missing.\n")
        sys.exit(1)

    try:
        config = supabase_store.load_config()
    except supabase_store.SupabaseConfigError as e:
        sys.stderr.write(f"Error: {e}\n")
        sys.exit(1)

    # Create Spotify client
    client = create_spotify_client()

    try:
        # Use a fresh connection with prepare_threshold=None to avoid prepared statement caching
        with psycopg.connect(
            config.database_url, 
            autocommit=False,
            prepare_threshold=None  # Disable prepared statement caching
        ) as conn:
            with conn.cursor() as cur:
                staging_schema = "staging"
                
                # Step 1: Get artists from listening history (first artist only)
                print("Extracting artists from listening history (first artist per track)...")
                history_artists = get_artists_from_listening_history(cur, staging_schema)
                print(f"Found {len(history_artists)} unique artists in listening history.")
                
                # Step 2: Get existing artists from artists table
                existing_artists = get_existing_artist_ids_and_names(cur, staging_schema)
                print(f"Found {len(existing_artists)} artists already in database.")
                
                # Step 3: Find artists that need to be added or updated
                artists_to_fetch = []
                artist_ids_to_fetch = []
                
                for artist_name, artist_id in history_artists:
                    if artist_id not in existing_artists:
                        # New artist - needs to be added
                        artists_to_fetch.append((artist_name, artist_id))
                        artist_ids_to_fetch.append(artist_id)
                    elif artist_id in existing_artists:
                        # Check if missing metadata
                        query = sql.SQL("""
                            SELECT image_url, genres, popularity 
                            FROM {schema}.artists 
                            WHERE artist_id = %s
                        """).format(schema=sql.Identifier(staging_schema))
                        cur.execute(query, (artist_id,))
                        result = cur.fetchone()
                        if result and (result[0] is None or result[1] is None or result[2] is None):
                            # Missing metadata - needs update
                            artists_to_fetch.append((artist_name, artist_id))
                            artist_ids_to_fetch.append(artist_id)
                
                if not artist_ids_to_fetch:
                    print("\nNo artists need metadata. All good!")
                    return
                
                print(f"\nFound {len(artist_ids_to_fetch)} artists that need metadata.")
                
                if dry_run:
                    print("\n[DRY RUN] Would fetch metadata for:")
                    for name, artist_id in artists_to_fetch[:20]:  # Show first 20
                        status = "NEW" if artist_id not in existing_artists else "UPDATE"
                        print(f"  [{status}] {name} ({artist_id})")
                    if len(artists_to_fetch) > 20:
                        print(f"  ... and {len(artists_to_fetch) - 20} more")
                    return
                
                # Step 4: Fetch metadata in batches
                batch_size = 50
                total_updated = 0
                total_added = 0
                
                for i in range(0, len(artist_ids_to_fetch), batch_size):
                    batch = artist_ids_to_fetch[i : i + batch_size]
                    print(f"\nFetching metadata for batch {i // batch_size + 1} ({len(batch)} artists)...")
                    
                    try:
                        # Fetch artist metadata
                        artists_data = supabase_store.fetch_artist_metadata(client, batch)
                        
                        if artists_data:
                            # Upsert artist records (will insert new or update existing)
                            supabase_store.upsert_artists(cur, staging_schema, artists_data)
                            
                            # Count new vs updated
                            for artist_data in artists_data:
                                if artist_data["artist_id"] not in existing_artists:
                                    total_added += 1
                                else:
                                    total_updated += 1
                            
                            print(f"  Processed {len(artists_data)} artists ({total_added} new, {total_updated} updated).")
                        else:
                            print(f"  Warning: No data returned for batch.")
                    except Exception as e:
                        print(f"  Error processing batch: {e}")
                        continue
                
                conn.commit()
                print(f"\n{'='*50}")
                print(f"Completed! Added {total_added} new artists, updated {total_updated} existing artists.")
                print(f"{'='*50}")
                
    except Exception as exc:
        sys.stderr.write(f"Error: {exc}\n")
        sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Backfill artist metadata for existing artists."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview what would be updated without making changes.",
    )
    args = parser.parse_args()
    
    backfill_artists(dry_run=args.dry_run)


if __name__ == "__main__":
    main()

