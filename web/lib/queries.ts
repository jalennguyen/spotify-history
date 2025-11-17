import { analyticsSupabase } from "./supabase";

// Type definitions for your views
export type RecentTrack = {
  played_at: string;
  played_at_date: string;
  track_id: string;
  track_name: string;
  artist_names: string;
  album_name: string;
  album_cover_url: string | null;
  duration_ms: number;
  duration_minutes: number;
  explicit: boolean;
  context_uri: string | null;
  ingested_at: string;
};

export type TopTrack = {
  track_id: string;
  track_name: string;
  artist_names: string | null;
  album_cover_url: string | null;
  play_count: number;
  total_minutes: number;
  total_hours: number;
  total_days: number;
  last_played_at: string;
  rank: number;
};

export type ListeningTotals = {
  window_key: string;
  window_label: string;
  play_count: number;
  distinct_track_count: number;
  total_minutes: number;
  total_hours: number;
  total_days: number;
  first_played_at: string;
  last_played_at: string;
};

export type DailyListeningTotal = {
  play_date: string;
  play_count: number;
  distinct_track_count: number;
  total_minutes: number;
  total_hours: number;
  total_days: number;
  total_duration_ms: number;
};

export type TopArtist = {
  window_key?: string;
  window_label?: string;
  period_type?: string;
  period_start?: string;
  period_label?: string;
  artist_names: string;
  image_url: string | null;
  play_count: number;
  total_minutes: number;
  total_hours: number;
  total_days: number;
  last_played_at: string;
  rank: number;
};

export type TopGenre = {
  window_key?: string;
  window_label?: string;
  period_type?: "month" | "year";
  period_start?: string;
  period_label?: string;
  genre: string;
  play_count: number;
  total_minutes: number;
  total_hours: number;
  total_days: number;
  last_played_at: string;
  rank: number;
};

// Query functions - queries analytics schema using standard Supabase client
// See: https://supabase.com/docs/guides/api/using-custom-schemas
export async function getRecentTracks(limit = 50): Promise<RecentTrack[]> {
  const { data, error } = await analyticsSupabase
    .from("recent_tracks")
    .select("*")
    .order("played_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(
      `Failed to fetch recent tracks: ${error.message}\n` +
        "Make sure analytics schema is exposed in Supabase API settings."
    );
  }

  return data || [];
}

export async function getTopGenresRolling(
  windowKey: string = "30d"
): Promise<TopGenre[]> {
  const { data, error } = await analyticsSupabase
    .from("top_genres_rolling")
    .select("*")
    .eq("window_key", windowKey)
    .order("rank", { ascending: true })
    .limit(50);

  if (error) {
    throw new Error(
      `Failed to fetch top genres (rolling): ${error.message}\n` +
        "Make sure analytics schema is exposed in Supabase API settings."
    );
  }

  return data || [];
}

export async function getTopGenresCalendar(
  periodType: "month" | "year" = "month",
  limit = 50
): Promise<TopGenre[]> {
  const { data, error } = await analyticsSupabase
    .from("top_genres_calendar")
    .select("*")
    .eq("period_type", periodType)
    .order("period_start", { ascending: false })
    .order("rank", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(
      `Failed to fetch top genres (calendar): ${error.message}\n` +
        "Make sure analytics schema is exposed in Supabase API settings."
    );
  }

  return data || [];
}

export async function getTopTracksRolling(
  windowKey: string = "30d"
): Promise<TopTrack[]> {
  const { data, error } = await analyticsSupabase
    .from("top_tracks_rolling")
    .select("*")
    .eq("window_key", windowKey)
    .order("rank", { ascending: true })
    .limit(50);

  if (error) {
    throw new Error(
      `Failed to fetch top tracks: ${error.message}\n` +
        "Make sure analytics schema is exposed in Supabase API settings."
    );
  }

  return data || [];
}

export async function getTopTracksCalendar(
  periodType: "month" | "year" = "month",
  limit = 50
): Promise<TopTrack[]> {
  const { data, error } = await analyticsSupabase
    .from("top_tracks_calendar")
    .select("*")
    .eq("period_type", periodType)
    .order("period_start", { ascending: false })
    .order("rank", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(
      `Failed to fetch top tracks calendar: ${error.message}\n` +
        "Make sure analytics schema is exposed in Supabase API settings."
    );
  }

  return data || [];
}

export async function getTotalMinutesAllTime(): Promise<number> {
  const { data, error } = await analyticsSupabase
    .from("listening_totals_windows")
    .select("total_minutes")
    .eq("window_key", "all_time")
    .single();

  if (error) {
    throw new Error(
      `Failed to fetch total minutes: ${error.message}\n` +
        "Make sure analytics schema is exposed in Supabase API settings."
    );
  }

  return data?.total_minutes || 0;
}

export async function getTotalSongsAllTime(): Promise<number> {
  const { data, error } = await analyticsSupabase
    .from("listening_totals_windows")
    .select("play_count")
    .eq("window_key", "all_time")
    .single();

  if (error) {
    throw new Error(
      `Failed to fetch total songs: ${error.message}\n` +
        "Make sure analytics schema is exposed in Supabase API settings."
    );
  }

  return data?.play_count || 0;
}

export async function getListeningTotals(
  windowKey?: string
): Promise<ListeningTotals[]> {
  let query = analyticsSupabase
    .from("listening_totals_windows")
    .select("*");

  if (windowKey) {
    query = query.eq("window_key", windowKey);
  }

  const { data, error } = await query.order("window_key", { ascending: true });

  if (error) {
    throw new Error(
      `Failed to fetch listening totals: ${error.message}\n` +
        "Make sure analytics schema is exposed in Supabase API settings."
    );
  }

  return data || [];
}

export async function getDailyListeningTotals(): Promise<DailyListeningTotal[]> {
  const { data, error } = await analyticsSupabase
    .from("daily_listening_totals")
    .select("*")
    .order("play_date", { ascending: true });

  if (error) {
    throw new Error(
      `Failed to fetch daily listening totals: ${error.message}\n` +
        "Make sure analytics schema is exposed in Supabase API settings."
    );
  }

  return data || [];
}

export async function getTopArtistsRolling(
  windowKey: string = "30d"
): Promise<TopArtist[]> {
  const { data, error } = await analyticsSupabase
    .from("top_artists_rolling")
    .select("*")
    .eq("window_key", windowKey)
    .order("rank", { ascending: true })
    .limit(50);

  if (error) {
    throw new Error(
      `Failed to fetch top artists: ${error.message}\n` +
        "Make sure analytics schema is exposed in Supabase API settings."
    );
  }

  return data || [];
}

