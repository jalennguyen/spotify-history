{{ config(materialized='view') }}

with plays as (
    select
        played_at,
        artist_names,
        duration_ms
    from {{ ref('track_history') }}
    where coalesce(artist_names, '') <> ''
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
        p.artist_names,
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
        artist_names,
        count(*) as play_count,
        sum(duration_ms) as total_duration_ms,
        max(played_at) as last_played_at
    from filtered
    group by 1, 2, 3
),

ranked as (
    select
        window_key,
        window_label,
        artist_names,
        play_count,
        total_duration_ms,
        last_played_at,
        row_number() over (
            partition by window_key
            order by play_count desc, total_duration_ms desc, artist_names
        ) as rank
    from aggregated
)

select
    window_key,
    window_label,
    artist_names,
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

