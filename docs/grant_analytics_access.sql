-- Grant access to analytics schema for anon and authenticated roles
-- Run this in your Supabase SQL Editor

-- Grant usage on the analytics schema
GRANT USAGE ON SCHEMA analytics TO anon, authenticated;

-- Grant select on all existing views in analytics schema
GRANT SELECT ON ALL TABLES IN SCHEMA analytics TO anon, authenticated;

-- Grant select on all future views in analytics schema (important for new dbt runs)
ALTER DEFAULT PRIVILEGES IN SCHEMA analytics 
GRANT SELECT ON TABLES TO anon, authenticated;

-- Optional: If you also want to grant access to staging schema
GRANT USAGE ON SCHEMA staging TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA staging TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA staging 
GRANT SELECT ON TABLES TO anon, authenticated;

