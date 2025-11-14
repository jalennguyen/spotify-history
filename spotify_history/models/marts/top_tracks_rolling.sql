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
        album_cover_url
    from {{ ref('track_history') }}
    where track_id is not null
    order by track_id, played_at desc
),

latest_play as (
    select coalesce(max(played_at), now()) as max_played_at from plays
),

windows as (
    select *
    from (values
        ('7d', 'Past 7 days', interval '7 days'),
        ('30d', 'Past 30 days', interval '30 days'),
        ('90d', 'Past 90 days', interval '90 days'),
        ('180d', 'Past 180 days', interval '180 days'),
        ('365d', 'Past 365 days', interval '365 days'),
        ('all_time', 'All time', null::interval)
    ) as t(window_key, window_label, window_interval)
),

filtered as (
    select
        w.window_key,
        w.window_label,
        p.track_id,
        p.track_name,
        p.duration_ms,
        p.played_at
    from plays p
    cross join latest_play lp
    join windows w on true
    where w.window_interval is null
       or p.played_at >= lp.max_played_at - w.window_interval
),

aggregated as (
    select
        window_key,
        window_label,
        track_id,
        track_name,
        count(*) as play_count,
        sum(duration_ms) as total_duration_ms,
        max(played_at) as last_played_at
    from filtered
    group by 1, 2, 3, 4
),

ranked as (
    select
        a.window_key,
        a.window_label,
        a.track_id,
        a.track_name,
        a.play_count,
        a.total_duration_ms,
        a.last_played_at,
        tm.album_cover_url,
        row_number() over (
            partition by a.window_key
            order by a.play_count desc, a.total_duration_ms desc, a.track_name
        ) as rank
    from aggregated a
    left join track_metadata tm on a.track_id = tm.track_id
)

select
    window_key,
    window_label,
    track_id,
    track_name,
    album_cover_url,
    play_count,
    total_duration_ms / 60000.0 as total_minutes,
    total_duration_ms / 3600000.0 as total_hours,
    total_duration_ms / 86400000.0 as total_days,
    last_played_at,
    rank
from ranked
where rank <= 50
order by
    case window_key
        when 'all_time' then 2
        else 1
    end,
    window_key,
    rank

