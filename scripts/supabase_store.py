"""Utilities for persisting Spotify listening history to Supabase/Postgres."""

from __future__ import annotations

import json
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import TYPE_CHECKING
import psycopg
from psycopg import sql

if TYPE_CHECKING:
    import spotipy


class SupabaseConfigError(RuntimeError):
    """Raised when Supabase persistence is requested but configuration is invalid."""


@dataclass(frozen=True)
class SupabaseConfig:
    database_url: str
    schema: str
    raw_table: str


def _require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise SupabaseConfigError(f"Missing environment variable {name} required for Supabase storage.")
    return value


def load_config() -> SupabaseConfig:
    """Load Supabase configuration from environment variables."""
    database_url = _require_env("SUPABASE_DB_URL")
    schema = os.getenv("SUPABASE_SCHEMA", "raw")
    raw_table = os.getenv("SUPABASE_RAW_TABLE", "raw_history")
    return SupabaseConfig(
        database_url=database_url,
        schema=schema,
        raw_table=raw_table,
    )


def _insert_raw_payload(cursor: psycopg.Cursor, config: SupabaseConfig, response: dict) -> None:
    payload_sql = sql.SQL(
        """
        INSERT INTO {schema}.{table} (collected_at, payload)
        VALUES (%s, %s)
        """
    ).format(
        schema=sql.Identifier(config.schema),
        table=sql.Identifier(config.raw_table),
    )
    collected_at = datetime.now(timezone.utc)
    payload = json.dumps(response)
    cursor.execute(payload_sql, (collected_at, payload))


def save_response(response: dict) -> None:
    """Persist the Spotify API response to Supabase/Postgres tables."""
    try:
        config = load_config()
    except SupabaseConfigError:
        raise
    except Exception as exc:  # pragma: no cover
        raise SupabaseConfigError(f"Failed to load Supabase configuration: {exc}") from exc

    try:
        with psycopg.connect(config.database_url, autocommit=False) as conn:
            with conn.cursor() as cur:
                _insert_raw_payload(cur, config, response)
            conn.commit()
    except SupabaseConfigError:
        raise
    except Exception as exc:
        raise SupabaseConfigError(f"Supabase persistence failed: {exc}") from exc


def is_configured() -> bool:
    """Return True if the Supabase configuration appears to be set."""
    return bool(os.getenv("SUPABASE_DB_URL"))


def warn_missing_config() -> None:
    message = (
        "Supabase configuration missing. Ensure SUPABASE_DB_URL and related variables are set "
        "when using --save-supabase."
    )
    sys.stderr.write(message + "\n")


def extract_artist_ids(response: dict) -> set[str]:
    """Extract unique artist IDs from Spotify API response.
    
    Only extracts the first artist ID from each track (for performance
    and to match how we display artists in the frontend).
    """
    artist_ids = set()
    items = response.get("items", [])
    for item in items:
        track = item.get("track", {})
        artists = track.get("artists", [])
        # Only get the first artist (matches how we display in frontend)
        if artists:
            artist_id = artists[0].get("id")
            if artist_id:
                artist_ids.add(artist_id)
    return artist_ids


def get_existing_artist_ids(cursor: psycopg.Cursor, schema: str) -> set[str]:
    """Query database for existing artist IDs."""
    query = sql.SQL("SELECT artist_id FROM {schema}.artists").format(
        schema=sql.Identifier(schema)
    )
    cursor.execute(query)
    return {row[0] for row in cursor.fetchall()}


def parse_artist_data(artist: dict) -> dict:
    """Extract and format artist fields from Spotify API response."""
    # Get largest image URL
    image_url = None
    images = artist.get("images", [])
    if images:
        # Sort by height descending and take the first (largest)
        sorted_images = sorted(
            images, key=lambda x: x.get("height", 0) or 0, reverse=True
        )
        if sorted_images:
            image_url = sorted_images[0].get("url")
    
    # Get Spotify URL
    spotify_url = artist.get("external_urls", {}).get("spotify")
    
    # Get genres (already an array)
    genres = artist.get("genres", [])
    
    # Get popularity (0-100)
    popularity = artist.get("popularity")
    
    return {
        "artist_id": artist.get("id"),
        "artist_name": artist.get("name"),
        "image_url": image_url,
        "spotify_url": spotify_url,
        "genres": genres,
        "popularity": popularity,
    }


def fetch_artist_metadata(client: "spotipy.Spotify", artist_ids: list[str]) -> list[dict]:
    """Batch fetch artist data from Spotify API (up to 50 at a time)."""
    if not artist_ids:
        return []
    
    all_artists = []
    # Spotify API allows up to 50 artists per request
    batch_size = 50
    for i in range(0, len(artist_ids), batch_size):
        batch = artist_ids[i : i + batch_size]
        try:
            response = client.artists(batch)
            artists = response.get("artists", [])
            for artist in artists:
                parsed = parse_artist_data(artist)
                if parsed["artist_id"]:  # Only include if we have an ID
                    all_artists.append(parsed)
        except Exception as e:
            # Log warning but continue
            sys.stderr.write(f"Warning: Failed to fetch artist metadata for batch: {e}\n")
    
    return all_artists


def upsert_artists(cursor: psycopg.Cursor, schema: str, artists: list[dict]) -> None:
    """Insert or update artist records in database."""
    if not artists:
        return
    
    upsert_sql = sql.SQL(
        """
        INSERT INTO {schema}.artists (
            artist_id, artist_name, image_url, spotify_url, genres, popularity,
            first_seen_at, last_updated_at, updated_at
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (artist_id) DO UPDATE SET
            artist_name = EXCLUDED.artist_name,
            image_url = EXCLUDED.image_url,
            spotify_url = EXCLUDED.spotify_url,
            genres = EXCLUDED.genres,
            popularity = EXCLUDED.popularity,
            last_updated_at = EXCLUDED.last_updated_at,
            updated_at = EXCLUDED.updated_at
        """
    ).format(schema=sql.Identifier(schema))
    
    now = datetime.now(timezone.utc)
    for artist in artists:
        cursor.execute(
            upsert_sql,
            (
                artist["artist_id"],
                artist["artist_name"],
                artist["image_url"],
                artist["spotify_url"],
                artist["genres"],
                artist["popularity"],
                now,  # first_seen_at (only used on insert)
                now,  # last_updated_at
                now,  # updated_at
            ),
        )


def save_response(response: dict, spotify_client: "spotipy.Spotify | None" = None) -> None:
    """Persist the Spotify API response to Supabase/Postgres tables.
    
    If spotify_client is provided, will also fetch and store metadata for new artists.
    """
    try:
        config = load_config()
    except SupabaseConfigError:
        raise
    except Exception as exc:  # pragma: no cover
        raise SupabaseConfigError(f"Failed to load Supabase configuration: {exc}") from exc

    try:
        with psycopg.connect(config.database_url, autocommit=False) as conn:
            with conn.cursor() as cur:
                # If Spotify client is provided, fetch and store artist metadata
                if spotify_client:
                    try:
                        # Extract artist IDs from response
                        artist_ids = extract_artist_ids(response)
                        
                        if artist_ids:
                            # Get existing artist IDs from database
                            # Use staging schema for artists table
                            staging_schema = "staging"
                            existing_ids = get_existing_artist_ids(cur, staging_schema)
                            
                            # Find new artists
                            new_artist_ids = list(artist_ids - existing_ids)
                            
                            if new_artist_ids:
                                # Fetch metadata for new artists
                                new_artists = fetch_artist_metadata(spotify_client, new_artist_ids)
                                
                                if new_artists:
                                    # Upsert artist records
                                    upsert_artists(cur, staging_schema, new_artists)
                    except Exception as e:
                        # Log warning but continue with saving raw payload
                        sys.stderr.write(f"Warning: Failed to process artist metadata: {e}\n")
                
                # Save raw payload
                _insert_raw_payload(cur, config, response)
            conn.commit()
    except SupabaseConfigError:
        raise
    except Exception as exc:
        raise SupabaseConfigError(f"Supabase persistence failed: {exc}") from exc

