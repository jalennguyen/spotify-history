{{ config(materialized='ephemeral') }}

-- Reference the staging.artists table directly
-- This model exists to make the table available to dbt ref() calls
-- Using ephemeral so dbt doesn't try to create/drop objects in staging schema
select
    artist_id,
    artist_name,
    image_url,
    spotify_url,
    genres,
    popularity,
    first_seen_at,
    last_updated_at,
    updated_at
from {{ source('spotify_staging', 'artists') }}

