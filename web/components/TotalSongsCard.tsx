"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Music4 } from "lucide-react";
import { getTotalSongsAllTime } from "@/lib/queries";

export function TotalSongsCard() {
  const [totalSongs, setTotalSongs] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTotalSongs() {
      try {
        setIsLoading(true);
        setError(null);
        const songs = await getTotalSongsAllTime();
        setTotalSongs(songs);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
        console.error("Error fetching total songs:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchTotalSongs();
  }, []);

  const formatSongs = (songs: number | null): string => {
    if (songs === null) return "—";
    return Math.round(songs).toLocaleString();
  };

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription>Total Songs Played</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          {isLoading ? "..." : formatSongs(totalSongs)}
        </CardTitle>
        <CardAction>
          <Badge variant="outline" className="bg-secondary/10 text-foreground">
            <Music4 className="h-3.5 w-3.5" />
            All time
          </Badge>
        </CardAction>
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5 text-sm">
        {error ? (
          <div className="text-destructive text-xs">{error}</div>
        ) : (
          <>
            <div className="line-clamp-1 flex gap-2 font-medium">
              Total song plays
              <Music4 className="h-4 w-4" />
            </div>
            <div className="text-muted-foreground">
              Based on all-time listening history
            </div>
          </>
        )}
      </CardFooter>
    </Card>
  );
}

