# Spotify Listening History Script

## Spotify API Credentials

Set the following environment variables before running the script:

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REDIRECT_URI`

You can create an app and retrieve these values from the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/).
The script reads these values (via `.env` or shell variables) and supplies them to the Spotify OAuth flow automatically.

## Supabase Storage Settings

If you want to persist your listening history to Supabase/Postgres, provide these additional variables:

- `SUPABASE_DB_URL` – full Postgres connection URL from Supabase (service role key recommended for automated jobs).
- `SUPABASE_SCHEMA` – schema to target, defaults to `public`.
- `SUPABASE_PLAYS_TABLE` – table for normalized play rows (e.g. `plays`).
- `SUPABASE_RAW_TABLE` – table for raw payload snapshots (e.g. `raw_history`).

You can copy `example.env`, fill in both the Spotify and Supabase values, and rename it to `.env`.

## Running the script

1. Install dependencies: `pip install -r requirements.txt`
2. Either add the values to a `.env` file (can copy from `example.env`) or export them in your shell.
3. Run `python scripts/fetch_history.py --limit 10` (omit `--limit` for the default 20 tracks). Use `--raw` to print the complete JSON response from Spotify.
4. On first run, approve the OAuth prompt that opens in your browser. The script then prints each track with timestamp, title, artists, album, and URL.

### Saving to Supabase

1. Create the required tables in Supabase (adjust names if you changed the env vars):

   ```sql
   create table if not exists public.plays (
     played_at timestamptz primary key,
     track_id text,
     track_name text,
     artist_names text,
     album_name text,
     duration_ms integer,
     explicit boolean,
     context_uri text,
     inserted_at timestamptz default now()
   );

   create table if not exists public.raw_history (
     id bigserial primary key,
     collected_at timestamptz not null,
     payload jsonb not null
   );
   ```

2. Export `SUPABASE_DB_URL` with your service-role connection string (include `?sslmode=require`).
3. Fetch and persist: `python scripts/fetch_history.py --limit 20 --save-supabase`
4. On success you’ll see `Saved N plays to Supabase.`; otherwise the script prints a warning and leaves the raw dump untouched.

### Automating with GitHub Actions

The repository ships with `.github/workflows/ingest.yml`, which runs hourly and on manual dispatch.

1. Add the following repository secrets:
   - `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`
   - `SPOTIFY_CACHE_JSON` – the contents of your local `.cache` file so the workflow can refresh tokens
   - `SUPABASE_DB_URL` (include `?sslmode=require`)
   - `SUPABASE_SCHEMA`, `SUPABASE_PLAYS_TABLE`, `SUPABASE_RAW_TABLE` if you use non-default names
2. The workflow installs dependencies, restores `.cache` if provided, and runs `python scripts/fetch_history.py --limit 50 --save-supabase`.

If the cache secret is missing, Spotipy can’t refresh the token and the workflow will fail with an OAuth prompt. Update the secret whenever you regenerate the `.cache` file locally.

