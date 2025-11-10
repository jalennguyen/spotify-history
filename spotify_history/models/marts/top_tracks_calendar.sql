{{ config(materialized='view') }}

with plays as (
    select
        played_at,
        track_id,
        track_name,
        duration_ms
    from {{ ref('track_history') }}
    where track_id is not null
),

monthly as (
    select
        'month'::text as period_type,
        date_trunc('month', played_at) as period_start,
        track_id,
        track_name,
        count(*) as play_count,
        sum(duration_ms) as total_duration_ms,
        max(played_at) as last_played_at
    from plays
    group by 1, 2, 3, 4
),

yearly as (
    select
        'year'::text as period_type,
        date_trunc('year', played_at) as period_start,
        track_id,
        track_name,
        count(*) as play_count,
        sum(duration_ms) as total_duration_ms,
        max(played_at) as last_played_at
    from plays
    group by 1, 2, 3, 4
),

combined as (
    select * from monthly
    union all
    select * from yearly
),

ranked as (
    select
        period_type,
        period_start,
        track_id,
        track_name,
        play_count,
        total_duration_ms,
        last_played_at,
        row_number() over (
            partition by period_type, period_start
            order by play_count desc, total_duration_ms desc, track_name
        ) as rank
    from combined
)

select
    period_type,
    period_start,
    case
        when period_type = 'month' then to_char(period_start, 'YYYY-MM')
        else to_char(period_start, 'YYYY')
    end as period_label,
    track_id,
    track_name,
    play_count,
    total_duration_ms / 60000.0 as total_minutes,
    total_duration_ms / 3600000.0 as total_hours,
    total_duration_ms / 86400000.0 as total_days,
    last_played_at,
    rank
from ranked
where rank <= 50
order by period_type, period_start desc, rank

