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
import { getTopArtistsRolling, TopArtist } from "@/lib/queries";

export function TopArtistsCard({ className }: { className?: string }) {
  const [artists, setArtists] = useState<TopArtist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTopArtists() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getTopArtistsRolling("30d");
        setArtists(data.slice(0, 5)); // Show top 5 artists
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
        console.error("Error fetching top artists:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchTopArtists();
  }, []);

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle>Top Artists</CardTitle>
        <CardDescription>Your most listened artists (30 days)</CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="text-destructive text-sm py-4">{error}</div>
        ) : isLoading ? (
          <div className="text-muted-foreground text-sm py-4">Loading...</div>
        ) : artists.length === 0 ? (
          <div className="text-muted-foreground text-sm py-4">No artists found</div>
        ) : (
          <div className="space-y-3">
            {artists.map((artist, index) => (
              <div
                key={`${artist.artist_names}-${index}`}
                className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50 transition-colors"
              >
                <img
                  src={artist.image_url || "https://via.placeholder.com/64"}
                  alt={artist.artist_names}
                  className="h-16 w-16 rounded-full object-cover"
                  onError={(e) => {
                    // Fallback to placeholder if image fails to load
                    (e.target as HTMLImageElement).src = "https://via.placeholder.com/64";
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{artist.artist_names}</p>
                  <p className="text-xs text-muted-foreground">
                    {artist.play_count.toLocaleString()} plays
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

