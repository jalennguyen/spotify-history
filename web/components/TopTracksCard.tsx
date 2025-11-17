"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getTopTracksRolling, TopTrack } from "@/lib/queries";

export function TopTracksCard({ className }: { className?: string }) {
  const [tracks, setTracks] = useState<TopTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTopTracks() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getTopTracksRolling("30d");
        setTracks(data.slice(0, 5)); // Show top 5 tracks
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
        console.error("Error fetching top tracks:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchTopTracks();
  }, []);

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle>Top Tracks</CardTitle>
        <CardDescription>Your most played songs (30 days)</CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="text-destructive text-sm py-4">{error}</div>
        ) : isLoading ? (
          <div className="text-muted-foreground text-sm py-4">Loading...</div>
        ) : tracks.length === 0 ? (
          <div className="text-muted-foreground text-sm py-4">No tracks found</div>
        ) : (
          <div className="space-y-3">
            {tracks.map((track) => (
              <div
                key={track.track_id}
                className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50 transition-colors"
              >
                <img
                  src={track.album_cover_url || "https://via.placeholder.com/64"}
                  alt={`${track.track_name}${track.artist_names ? ` by ${track.artist_names}` : ""}`}
                  className="h-16 w-16 rounded-md object-cover"
                  onError={(e) => {
                    // Fallback to placeholder if image fails to load
                    (e.target as HTMLImageElement).src = "https://via.placeholder.com/64";
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{track.track_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {track.artist_names || "Unknown Artist"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {track.play_count.toLocaleString()} plays
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

