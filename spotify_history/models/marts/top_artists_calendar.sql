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

-- Extract first artist name from comma-separated string for matching
artist_metadata as (
    select
        c.period_type,
        c.period_start,
        c.artist_names,
        c.play_count,
        c.total_duration_ms,
        c.last_played_at,
        -- Get first artist name (before first comma)
        split_part(c.artist_names, ',', 1) as first_artist_name
    from combined c
),

ranked as (
    select
        am.period_type,
        am.period_start,
        am.artist_names,
        am.play_count,
        am.total_duration_ms,
        am.last_played_at,
        art.image_url,
        row_number() over (
            partition by am.period_type, am.period_start
            order by am.play_count desc, am.total_duration_ms desc, am.artist_names
        ) as rank
    from artist_metadata am
    left join {{ source('spotify_staging', 'artists') }} art on trim(art.artist_name) = trim(am.first_artist_name)
)

select
    period_type,
    period_start,
    case
        when period_type = 'month' then to_char(period_start, 'YYYY-MM')
        else to_char(period_start, 'YYYY')
    end as period_label,
    artist_names,
    image_url,
    play_count,
    total_duration_ms / 60000.0 as total_minutes,
    total_duration_ms / 3600000.0 as total_hours,
    total_duration_ms / 86400000.0 as total_days,
    last_played_at,
    rank
from ranked
where rank <= 50
order by period_type, period_start desc, rank

