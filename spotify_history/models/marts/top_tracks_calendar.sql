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

track_metadata as (
    select distinct on (track_id)
        track_id,
        track_name,
        artist_names,
        album_cover_url
    from {{ ref('track_history') }}
    where track_id is not null
    order by track_id, played_at desc
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
        c.period_type,
        c.period_start,
        c.track_id,
        c.track_name,
        c.play_count,
        c.total_duration_ms,
        c.last_played_at,
        tm.artist_names,
        tm.album_cover_url,
        row_number() over (
            partition by c.period_type, c.period_start
            order by c.play_count desc, c.total_duration_ms desc, c.track_name
        ) as rank
    from combined c
    left join track_metadata tm on c.track_id = tm.track_id
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
    artist_names,
    album_cover_url,
    play_count,
    total_duration_ms / 60000.0 as total_minutes,
    total_duration_ms / 3600000.0 as total_hours,
    total_duration_ms / 86400000.0 as total_days,
    last_played_at,
    rank
from ranked
where rank <= 50
order by period_type, period_start desc, rank

