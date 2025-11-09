"""Utilities for persisting Spotify listening history to Supabase/Postgres."""

from __future__ import annotations

import json
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable, List, Tuple

import pandas as pd
import psycopg
from psycopg import sql


class SupabaseConfigError(RuntimeError):
    """Raised when Supabase persistence is requested but configuration is invalid."""


@dataclass(frozen=True)
class SupabaseConfig:
    database_url: str
    schema: str
    plays_table: str
    raw_table: str


def _require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise SupabaseConfigError(f"Missing environment variable {name} required for Supabase storage.")
    return value


def load_config() -> SupabaseConfig:
    """Load Supabase configuration from environment variables."""
    database_url = _require_env("SUPABASE_DB_URL")
    schema = os.getenv("SUPABASE_SCHEMA", "public")
    plays_table = os.getenv("SUPABASE_PLAYS_TABLE", "plays")
    raw_table = os.getenv("SUPABASE_RAW_TABLE", "raw_history")
    return SupabaseConfig(
        database_url=database_url,
        schema=schema,
        plays_table=plays_table,
        raw_table=raw_table,
    )


def _build_plays_dataframe(response: dict) -> pd.DataFrame:
    rows: List[dict] = []
    for item in response.get("items", []):
        track = item.get("track") or {}
        album = track.get("album") or {}
        artists = track.get("artists") or []
        rows.append(
            {
                "played_at": item.get("played_at"),
                "track_id": track.get("id"),
                "track_name": track.get("name"),
                "artist_names": ", ".join(artist.get("name", "") for artist in artists if artist.get("name")),
                "album_name": album.get("name"),
                "duration_ms": track.get("duration_ms"),
                "explicit": track.get("explicit"),
                "context_uri": (item.get("context") or {}).get("uri"),
            }
        )

    columns = [
        "played_at",
        "track_id",
        "track_name",
        "artist_names",
        "album_name",
        "duration_ms",
        "explicit",
        "context_uri",
    ]
    df = pd.DataFrame(rows, columns=columns)
    if df.empty:
        return df
    # Deduplicate by played_at to avoid duplicate upserts when Spotify returns overlapping windows.
    df = df.dropna(subset=["played_at"]).drop_duplicates(subset=["played_at"], keep="last")
    return df


def _upsert_plays(cursor: psycopg.Cursor, config: SupabaseConfig, df: pd.DataFrame) -> None:
    if df.empty:
        return

    columns = list(df.columns)
    insert_sql = sql.SQL(
        """
        INSERT INTO {schema}.{table} ({columns})
        VALUES ({placeholders})
        ON CONFLICT (played_at) DO UPDATE SET
            {updates}
        """
    ).format(
        schema=sql.Identifier(config.schema),
        table=sql.Identifier(config.plays_table),
        columns=sql.SQL(", ").join(sql.Identifier(col) for col in columns),
        placeholders=sql.SQL(", ").join(sql.Placeholder() for _ in columns),
        updates=sql.SQL(", ").join(
            sql.SQL("{col} = EXCLUDED.{col}").format(col=sql.Identifier(col)) for col in columns if col != "played_at"
        ),
    )

    records: Iterable[Tuple] = df.itertuples(index=False, name=None)
    cursor.executemany(insert_sql, records)


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

    plays_df = _build_plays_dataframe(response)

    try:
        with psycopg.connect(config.database_url, autocommit=False) as conn:
            with conn.cursor() as cur:
                _upsert_plays(cur, config, plays_df)
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

