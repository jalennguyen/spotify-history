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

monthly as (
    select
        'month'::text as period_type,
        date_trunc('month', played_at) as period_start,
        genre,
        count(*) as play_count,
        sum(duration_ms) as total_duration_ms,
        max(played_at) as last_played_at
    from first_genre
    group by 1, 2, 3
),

yearly as (
    select
        'year'::text as period_type,
        date_trunc('year', played_at) as period_start,
        genre,
        count(*) as play_count,
        sum(duration_ms) as total_duration_ms,
        max(played_at) as last_played_at
    from first_genre
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
        c.genre,
        c.play_count,
        c.total_duration_ms,
        c.last_played_at,
        row_number() over (
            partition by c.period_type, c.period_start
            order by c.play_count desc, c.total_duration_ms desc, c.genre
        ) as rank
    from combined c
)

select
  period_type,
  period_start,
  case when period_type = 'month' then to_char(period_start, 'YYYY-MM')
       else to_char(period_start, 'YYYY') end as period_label,
  genre,
  play_count,
  total_duration_ms / 60000.0 as total_minutes,
  total_duration_ms / 3600000.0 as total_hours,
  total_duration_ms / 86400000.0 as total_days,
  last_played_at,
  rank
from ranked
where rank <= 50
order by period_type, period_start desc, rank


