# Spotify Supabase Integration Plan

1. Dependencies & Configuration
   - Add Supabase-related dependencies (e.g., `psycopg[binary]`, `pandas`) to `requirements.txt`.
   - Expand `example.env` and `README.md` with Supabase settings (`SUPABASE_DB_URL`, optional schema/table names) and ensure `.cache` is ignored/removed.
2. Supabase Persistence Logic
   - Create `scripts/supabase_store.py` to upsert normalized plays/tracks/artists and append raw payloads using Supabase credentials.
   - Update `scripts/fetch_history.py` with a `--save-supabase` flag that calls the new module after fetching tracks.
3. Documentation & Schema
   - Document required Supabase tables (SQL snippet) and usage instructions in `README.md`, including steps for generating refresh tokens.
4. GitHub Actions Workflow
   - Add `.github/workflows/ingest.yml` to run on a schedule, installing dependencies and executing the fetch script with Supabase saving enabled, referencing required secrets.
