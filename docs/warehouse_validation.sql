-- Check total rows loaded in the analytics fact table
select count(*) as plays_row_count
from analytics.fct_spotify__plays;

-- Compare max played_at values between raw snapshots and analytics fact
select
  max((item ->> 'played_at')::timestamptz) as latest_raw_played_at,
  (select max(played_at) from analytics.fct_spotify__plays) as latest_fact_played_at
from raw.raw_history r
  cross join lateral jsonb_array_elements(r.payload -> 'items') as item;

-- Inspect a sample of the most recent plays to ensure fields look correct
select
  played_at,
  track_name,
  artist_names,
  context_uri,
  ingested_at
from analytics.fct_spotify__plays
order by played_at desc
limit 20;

