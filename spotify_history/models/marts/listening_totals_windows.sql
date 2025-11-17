{{ config(materialized='view') }}

with plays as (
    select
        played_at,
        duration_ms,
        track_id,
        artist_names
    from {{ ref('track_history') }}
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
        p.duration_ms,
        p.track_id,
        p.played_at,
        p.artist_names
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
        count(*) as play_count,
        count(distinct track_id) as distinct_track_count,
        sum(duration_ms) as total_duration_ms,
        min(played_at) as first_played_at,
        max(played_at) as last_played_at
    from filtered
    group by 1, 2
),
artist_counts as (
    select
        window_key,
        count(distinct trim(split_part(artist_names, ',', 1))) as distinct_artist_count
    from filtered
    where coalesce(artist_names, '') <> ''
    group by 1
)

select
    a.window_key,
    a.window_label,
    a.play_count,
    a.distinct_track_count,
    coalesce(ac.distinct_artist_count, 0) as distinct_artist_count,
    a.total_duration_ms / 60000.0 as total_minutes,
    a.total_duration_ms / 3600000.0 as total_hours,
    a.total_duration_ms / 86400000.0 as total_days,
    a.first_played_at,
    a.last_played_at
from aggregated a
left join artist_counts ac on a.window_key = ac.window_key
order by
    case a.window_key
        when 'all_time' then 2
        else 1
    end,
    a.window_key

