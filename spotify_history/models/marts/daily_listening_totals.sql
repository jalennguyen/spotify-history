{{ config(materialized='view') }}

with plays as (
    select
        played_at,
        duration_ms,
        track_id
    from {{ ref('track_history') }}
)

select
    date_trunc('day', played_at)::date as play_date,
    count(*) as play_count,
    count(distinct track_id) as distinct_track_count,
    sum(duration_ms) / 60000.0 as total_minutes,
    sum(duration_ms) / 3600000.0 as total_hours,
    sum(duration_ms) / 86400000.0 as total_days,
    sum(duration_ms) as total_duration_ms
from plays
group by 1
order by play_date

