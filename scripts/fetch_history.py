"""Fetch and display your recently played Spotify tracks.

Environment variables required:
- SPOTIFY_CLIENT_ID
- SPOTIFY_CLIENT_SECRET
- SPOTIFY_REDIRECT_URI

Usage:
    python scripts/fetch_history.py --limit 10
    python scripts/fetch_history.py --raw
    python scripts/fetch_history.py --save-supabase

The first run opens a browser window to authorize the app. Subsequent runs
reuse the cached token stored in `.cache`.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime
from typing import Iterable

import spotipy
from spotipy.oauth2 import SpotifyOAuth
from dotenv import load_dotenv  # type: ignore

import supabase_store


SCOPE = "user-read-recently-played"

# Load variables from a .env file if present.
load_dotenv()


def _require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        sys.stderr.write(f"Missing environment variable: {name}\n")
        sys.exit(1)
    return value


def create_spotify_client() -> spotipy.Spotify:
    client_id = _require_env("SPOTIFY_CLIENT_ID")
    client_secret = _require_env("SPOTIFY_CLIENT_SECRET")
    redirect_uri = _require_env("SPOTIFY_REDIRECT_URI")

    auth_manager = SpotifyOAuth(
        scope=SCOPE,
        client_id=client_id,
        client_secret=client_secret,
        redirect_uri=redirect_uri,
    )
    return spotipy.Spotify(auth_manager=auth_manager)


def fetch_recent_tracks(client: spotipy.Spotify, limit: int) -> dict:
    return client.current_user_recently_played(limit=limit)


def format_timestamp(iso_ts: str) -> str:
    try:
        dt = datetime.fromisoformat(iso_ts.replace("Z", "+00:00"))
    except ValueError:
        return iso_ts
    return dt.astimezone().strftime("%Y-%m-%d %H:%M:%S %Z")


def print_tracks(tracks: Iterable[dict]) -> None:
    for item in tracks:
        track = item.get("track", {})
        artists = ", ".join(artist["name"] for artist in track.get("artists", []))
        played_at = format_timestamp(item.get("played_at", ""))
        external_url = track.get("external_urls", {}).get("spotify", "N/A")

        print(
            f"{played_at} | {track.get('name', 'Unknown Title')} — {artists}\n"
            f"Album: {track.get('album', {}).get('name', 'Unknown Album')}\n"
            f"URL: {external_url}\n"
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Display Spotify listening history."
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=20,
        help="Number of recent tracks to retrieve (1-50).",
    )
    parser.add_argument(
        "--raw",
        action="store_true",
        help="Print the raw JSON response instead of a formatted summary.",
    )
    parser.add_argument(
        "--save-supabase",
        action="store_true",
        help="Persist the fetched response to Supabase/Postgres tables.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    limit = max(1, min(args.limit, 50))

    client = create_spotify_client()
    response = fetch_recent_tracks(client, limit=limit)
    tracks = response.get("items", [])

    if args.save_supabase:
        supabase_success = False
        if not supabase_store.is_configured():
            supabase_store.warn_missing_config()
        else:
            try:
                supabase_store.save_response(response, spotify_client=client)
                supabase_success = True
            except supabase_store.SupabaseConfigError as exc:
                sys.stderr.write(f"{exc}\n")
            if supabase_success:
                print(f"Saved {len(tracks)} plays to Supabase.")
            elif tracks:
                print("Supabase save skipped due to configuration issue.")
            else:
                print("Supabase save skipped; no tracks returned.")

    if args.raw:
        print(json.dumps(response, indent=2))
    elif not args.save_supabase:
        if not tracks:
            print("No recent tracks found.")
        else:
            print_tracks(tracks)


if __name__ == "__main__":
    main()

