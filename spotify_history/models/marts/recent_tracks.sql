{{ config(materialized='view') }}

select
    played_at,
    date_trunc('day', played_at) as played_at_date,
    track_id,
    track_name,
    artist_names,
    album_name,
    album_cover_url,
    duration_ms,
    duration_ms / 60000.0 as duration_minutes,
    explicit,
    context_uri,
    ingested_at
from {{ ref('track_history') }}
order by played_at desc
limit 50

