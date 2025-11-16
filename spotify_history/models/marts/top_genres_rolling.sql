{{ config(materialized='view') }}

with plays as (
    select
        played_at,
        artist_names,
        duration_ms
    from {{ ref('track_history') }}
    where coalesce(artist_names, '') <> ''
),

-- First credited artist per play
first_artist as (
    select
        p.played_at,
        trim(split_part(p.artist_names, ',', 1)) as first_artist_name,
        p.duration_ms
    from plays p
),

-- Join to artist metadata to get genres (array of text)
artist_with_genres as (
    select
        fa.played_at,
        fa.duration_ms,
        a.genres
    from first_artist fa
    left join {{ source('spotify_staging', 'artists') }} a
      on trim(a.artist_name) = fa.first_artist_name
),

-- Choose only the first genre (no weighting)
first_genre as (
    select
        awg.played_at,
        awg.duration_ms,
        case when array_length(awg.genres, 1) >= 1 then awg.genres[1] end as genre
    from artist_with_genres awg
    where coalesce(array_length(awg.genres, 1), 0) > 0
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
        fg.genre,
        fg.duration_ms,
        fg.played_at
    from first_genre fg
    cross join latest_play lp
    join windows w on true
    where w.window_interval is null
       or fg.played_at >= lp.max_played_at - w.window_interval
),

aggregated as (
    select
        window_key,
        window_label,
        genre,
        count(*) as play_count,
        sum(duration_ms) as total_duration_ms,
        max(played_at) as last_played_at
    from filtered
    group by 1, 2, 3
),

ranked as (
    select
        a.window_key,
        a.window_label,
        a.genre,
        a.play_count,
        a.total_duration_ms,
        a.last_played_at,
        row_number() over (
            partition by a.window_key
            order by a.play_count desc, a.total_duration_ms desc, a.genre
        ) as rank
    from aggregated a
)

select
    window_key,
    window_label,
    genre,
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
