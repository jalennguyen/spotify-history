{{ config(materialized='view') }}

with plays as (
    select
        played_at,
        artist_names,
        duration_ms
    from {{ ref('track_history') }}
    where coalesce(artist_names, '') <> ''
),

monthly as (
    select
        'month'::text as period_type,
        date_trunc('month', played_at) as period_start,
        artist_names,
        count(*) as play_count,
        sum(duration_ms) as total_duration_ms,
        max(played_at) as last_played_at
    from plays
    group by 1, 2, 3
),

yearly as (
    select
        'year'::text as period_type,
        date_trunc('year', played_at) as period_start,
        artist_names,
        count(*) as play_count,
        sum(duration_ms) as total_duration_ms,
        max(played_at) as last_played_at
    from plays
    group by 1, 2, 3
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
        artist_names,
        play_count,
        total_duration_ms,
        last_played_at,
        row_number() over (
            partition by period_type, period_start
            order by play_count desc, total_duration_ms desc, artist_names
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
    artist_names,
    play_count,
    total_duration_ms / 60000.0 as total_minutes,
    total_duration_ms / 3600000.0 as total_hours,
    total_duration_ms / 86400000.0 as total_days,
    last_played_at,
    rank
from ranked
where rank <= 50
order by period_type, period_start desc, rank

