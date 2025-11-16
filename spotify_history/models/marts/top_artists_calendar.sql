{{ config(materialized='view') }}

with plays as (
    select
        played_at,
        artist_names,
        duration_ms
    from {{ ref('track_history') }}
    where coalesce(artist_names, '') <> ''
),

-- Derive first credited artist for each play
first_artist as (
    select
        played_at,
        trim(split_part(artist_names, ',', 1)) as first_artist_name,
        duration_ms
    from plays
),

monthly as (
    select
        'month'::text as period_type,
        date_trunc('month', played_at) as period_start,
        first_artist_name,
        count(*) as play_count,
        sum(duration_ms) as total_duration_ms,
        max(played_at) as last_played_at
    from first_artist
    group by 1, 2, 3
),

yearly as (
    select
        'year'::text as period_type,
        date_trunc('year', played_at) as period_start,
        first_artist_name,
        count(*) as play_count,
        sum(duration_ms) as total_duration_ms,
        max(played_at) as last_played_at
    from first_artist
    group by 1, 2, 3
),

combined as (
    select * from monthly
    union all
    select * from yearly
),

ranked as (
    select
        c.period_type,
        c.period_start,
        c.first_artist_name as artist_name,
        c.play_count,
        c.total_duration_ms,
        c.last_played_at,
        art.image_url,
        row_number() over (
            partition by c.period_type, c.period_start
            order by c.play_count desc, c.total_duration_ms desc, c.first_artist_name
        ) as rank
    from combined c
    left join {{ source('spotify_staging', 'artists') }} art
      on trim(art.artist_name) = c.first_artist_name
)

select
    period_type,
    period_start,
    case
        when period_type = 'month' then to_char(period_start, 'YYYY-MM')
        else to_char(period_start, 'YYYY')
    end as period_label,
    artist_name as artist_names,
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
