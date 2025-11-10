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
- `SUPABASE_SCHEMA` – schema to target for ingestion, defaults to `raw`.
- `SUPABASE_RAW_TABLE` – table for raw payload snapshots (e.g. `raw_history`).

You can copy `example.env`, fill in both the Spotify and Supabase values, and rename it to `.env`.

## Running the script

1. Install dependencies: `pip install -r requirements.txt`
2. Either add the values to a `.env` file (can copy from `example.env`) or export them in your shell.
3. Run `python scripts/fetch_history.py --limit 10` (omit `--limit` for the default 20 tracks). Use `--raw` to print the complete JSON response from Spotify.
4. On first run, approve the OAuth prompt that opens in your browser. The script then prints each track with timestamp, title, artists, album, and URL.

### Saving to Supabase

1. Create the required schemas and tables in Supabase (adjust names if you changed the env vars):

   ```sql
   create schema if not exists raw;
   create schema if not exists staging;
   create schema if not exists analytics;

   create table if not exists raw.raw_history (
     id bigserial primary key,
     collected_at timestamptz not null,
     payload jsonb not null
   );
   ```

2. Export `SUPABASE_DB_URL` with your service-role connection string (include `?sslmode=require`).
3. Optionally set `SUPABASE_SCHEMA` and `SUPABASE_RAW_TABLE` if you use custom names.
4. Fetch and persist: `python scripts/fetch_history.py --limit 20 --save-supabase`
5. On success you’ll see `Saved N plays to Supabase.`; otherwise the script prints a warning and leaves the raw dump untouched.

### Transforming with dbt

The dbt project lives in the `spotify_history/` directory. Models are split into:

- `staging/stg_spotify__plays`: incremental view over the raw JSON snapshots (materialized in the `staging` schema).
- `marts/fct_spotify__plays`: incremental fact table used for analysis (materialized in the `analytics` schema).

1. Change into the project: `cd spotify_history`
2. Verify connectivity: `dbt debug`
3. Run the models: `dbt run --select stg_spotify__plays fct_spotify__plays`
4. Run tests: `dbt test --select stg_spotify__plays fct_spotify__plays`

Both models are incremental and safe to rebuild; dbt keeps the latest record per `played_at`.
For ad-hoc validation queries, see `docs/warehouse_validation.sql`.
Freshness thresholds for the `raw_history` source live in `spotify_history/models/sources.yml` (defaults warn after 3 hours, error after 6). You can safely drop any historical schemas such as `public_staging` or `public_analytics` once the new convention is in place.

### Validating Supabase data

After a run, sanity-check the warehouse. Useful queries:

```sql
-- confirm the latest play timestamp matches Spotify history
select played_at, track_name, artist_names
from analytics.fct_spotify__plays
order by played_at desc
limit 10;

-- watch for duplicate timestamps
select played_at, count(*)
from analytics.fct_spotify__plays
group by played_at
having count(*) > 1;
```

Keep notes of any issues or data quality checks alongside the queries you use.

### Automating with GitHub Actions

The repository ships with `.github/workflows/ingest.yml`, which runs hourly and on manual dispatch.

1. Add the following repository secrets:
   - `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`
   - `SPOTIFY_CACHE_JSON` – the contents of your local `.cache` file so the workflow can refresh tokens
   - `SUPABASE_DB_URL` (include `?sslmode=require`)
   - `SUPABASE_SCHEMA` (optional, defaults to `raw`) and `SUPABASE_RAW_TABLE` if you use non-default names
2. The workflow installs dependencies, restores `.cache` if provided, runs the ingest script, builds/tests the dbt models (using a generated profile with `sslmode=require`), and checks source freshness.

If the cache secret is missing, Spotipy can’t refresh the token and the workflow will fail with an OAuth prompt. Update the secret whenever you regenerate the `.cache` file locally.