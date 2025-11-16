-- Create staging.artists table to store artist metadata from Spotify API
CREATE TABLE IF NOT EXISTS staging.artists (
    artist_id TEXT PRIMARY KEY,
    artist_name TEXT NOT NULL,
    image_url TEXT,
    spotify_url TEXT,
    genres TEXT[],
    popularity INTEGER,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artists_artist_id ON staging.artists(artist_id);


