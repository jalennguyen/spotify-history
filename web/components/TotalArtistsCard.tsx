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
import { Users } from "lucide-react";
import { getTotalArtistsAllTime } from "@/lib/queries";

export function TotalArtistsCard() {
  const [totalArtists, setTotalArtists] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTotalArtists() {
      try {
        setIsLoading(true);
        setError(null);
        const artists = await getTotalArtistsAllTime();
        setTotalArtists(artists);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
        console.error("Error fetching total artists:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchTotalArtists();
  }, []);

  const formatArtists = (artists: number | null): string => {
    if (artists === null) return "—";
    return Math.round(artists).toLocaleString();
  };

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription>Total Artists Played</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          {isLoading ? "..." : formatArtists(totalArtists)}
        </CardTitle>
        <CardAction>
          <Badge variant="outline" className="bg-secondary/10 text-foreground">
            <Users className="h-3.5 w-3.5" />
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
              Unique artists
              <Users className="h-4 w-4" />
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

