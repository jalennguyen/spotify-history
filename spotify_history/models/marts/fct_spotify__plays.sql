{{ config(
    materialized='incremental',
    unique_key='played_at'
) }}

select
    played_at,
    date_trunc('day', played_at) as played_at_date,
    track_id,
    track_name,
    artist_names,
    album_name,
    duration_ms,
    explicit,
    context_uri,
    ingested_at
from {{ ref('stg_spotify__plays') }}
{% if is_incremental() %}
where played_at > (
    select coalesce(max(played_at), '1970-01-01'::timestamptz)
    from {{ this }}
)
{% endif %}

