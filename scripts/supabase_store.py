"""Utilities for persisting Spotify listening history to Supabase/Postgres."""

from __future__ import annotations

import json
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
import psycopg
from psycopg import sql


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

