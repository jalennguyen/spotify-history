{{ config(
    materialized='incremental',
    unique_key='played_at'
) }}

with source_payload as (
    select
        collected_at,
        jsonb_array_elements(payload -> 'items') as item
    from {{ source('spotify', 'raw_history') }}
    {% if is_incremental() %}
    where collected_at > (
        select coalesce(max(ingested_at), '1970-01-01'::timestamptz)
        from {{ this }}
    )
    {% endif %}
),
expanded as (
    select
        collected_at,
        item,
        item ->> 'played_at' as played_at_text,
        item -> 'track' as track,
        item -> 'context' as context
    from source_payload
),
with_artists as (
    select
        e.collected_at,
        e.item,
        e.played_at_text,
        e.track,
        e.context,
        string_agg(artist_elem ->> 'name', ', ' order by artist_elem ->> 'name') as artist_names
    from expanded e
    left join lateral jsonb_array_elements(
        coalesce(e.track -> 'artists', '[]'::jsonb)
    ) as artist_elem on true
    group by e.collected_at, e.item, e.played_at_text, e.track, e.context
),
deduped as (
    select
        (played_at_text)::timestamptz as played_at,
        track ->> 'id' as track_id,
        track ->> 'name' as track_name,
        nullif(artist_names, '') as artist_names,
        track -> 'album' ->> 'name' as album_name,
        (
            select img ->> 'url'
            from jsonb_array_elements(track -> 'album' -> 'images') as img
            order by (img ->> 'height')::int desc nulls last
            limit 1
        ) as album_cover_url,
        nullif(track ->> 'duration_ms', '')::int as duration_ms,
        (track ->> 'explicit')::boolean as explicit,
        context ->> 'uri' as context_uri,
        collected_at as ingested_at,
        row_number() over (
            partition by played_at_text
            order by collected_at desc
        ) as recency_rank
    from with_artists
)

select
    played_at,
    track_id,
    track_name,
    artist_names,
    album_name,
    album_cover_url,
    duration_ms,
    explicit,
    context_uri,
    ingested_at
from deduped
where recency_rank = 1

