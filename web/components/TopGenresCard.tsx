import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { getTopGenresRolling, TopGenre } from "@/lib/queries";

type Genre = {
  id: string;
  name: string;
  playCount?: number;
  color?: string;
};

const placeholderGenres: Genre[] = [
  {
    id: "1",
    name: "Pop",
    playCount: 2341,
    color: "bg-pink-500",
  },
  {
    id: "2",
    name: "Rock",
    playCount: 1892,
    color: "bg-red-500",
  },
  {
    id: "3",
    name: "Hip Hop",
    playCount: 1567,
    color: "bg-purple-500",
  },
  {
    id: "4",
    name: "Electronic",
    playCount: 1234,
    color: "bg-blue-500",
  },
  {
    id: "5",
    name: "Jazz",
    playCount: 987,
    color: "bg-yellow-500",
  },
];

export function TopGenresCard({ className }: { className?: string }) {
  const [genres, setGenres] = useState<TopGenre[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function capitalizeWords(text: string | null | undefined): string {
    if (!text) return "Unknown";
    return text
      .split(" ")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  function stringToHslColor(text: string, s = 65, l = 45): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = text.charCodeAt(i) + ((hash << 5) - hash);
      hash |= 0;
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue} ${s}% ${l}%)`;
  }

  useEffect(() => {
    async function fetchTopGenres() {
      try {
        setIsLoading(true);
        setError(null);
        // All-time window uses window_key='all_time' in the rolling view
        const data = await getTopGenresRolling("all_time");
        setGenres(data.slice(0, 5));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
        console.error("Error fetching top genres:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchTopGenres();
  }, []);

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle>Top Genres</CardTitle>
        <CardDescription>Your most listened genres (all time)</CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="text-destructive text-sm py-4">{error}</div>
        ) : isLoading ? (
          <div className="text-muted-foreground text-sm py-4">Loading...</div>
        ) : genres.length === 0 ? (
          <div className="text-muted-foreground text-sm py-4">No genres found</div>
        ) : (
          <div className="space-y-3">
            {genres.map((g) => (
              <div
                key={`${g.genre}`}
                className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50 transition-colors"
              >
                <div
                  className={cn(
                    "h-16 w-16 rounded-md flex items-center justify-center text-white font-semibold text-md"
                  )}
                  style={{ backgroundColor: stringToHslColor(g.genre || "Unknown") }}
                >
                  {g.genre?.charAt(0).toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{capitalizeWords(g.genre)}</p>
                  <p className="text-xs text-muted-foreground">
                    {g.play_count.toLocaleString()} plays
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

