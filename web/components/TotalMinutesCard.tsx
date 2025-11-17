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
import { ChevronDown, ChevronUp, TrendingUp } from "lucide-react";
import { getTotalMinutesAllTime } from "@/lib/queries";

type TotalMinutesCardProps = {
  isOpen: boolean;
  onToggle: () => void;
};

export function TotalMinutesCard({ isOpen, onToggle }: TotalMinutesCardProps) {
  const [totalMinutes, setTotalMinutes] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTotalMinutes() {
      try {
        setIsLoading(true);
        setError(null);
        const minutes = await getTotalMinutesAllTime();
        setTotalMinutes(minutes);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
        console.error("Error fetching total minutes:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchTotalMinutes();
  }, []);

  const formatMinutes = (minutes: number | null): string => {
    if (minutes === null) return "—";
    return Math.round(minutes).toLocaleString();
  };

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggle();
        }
      }}
      aria-expanded={isOpen}
      className="@container/card cursor-pointer transition shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
    >
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardDescription>Total Minutes Listened</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {isLoading ? "..." : formatMinutes(totalMinutes)}
          </CardTitle>
        </div>
        <div className="flex flex-col items-end gap-3">
          <CardAction>
            <Badge variant="outline" className="bg-primary/10 text-primary">
              <TrendingUp className="h-3.5 w-3.5" />
              All time
            </Badge>
          </CardAction>
          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          )}
        </div>
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5 text-sm">
        {error ? (
          <div className="text-destructive text-xs">{error}</div>
        ) : (
          <>
            <div className="line-clamp-1 flex gap-2 font-medium">
              Total listening time
              <TrendingUp className="h-4 w-4" />
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