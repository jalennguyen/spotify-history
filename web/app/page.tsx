"use client";

import { useState } from "react";

import { DailyMinutesChart } from "@/components/DailyMinutesChart";
import { TotalMinutesCard } from "@/components/TotalMinutesCard";
import { TotalSongsCard } from "@/components/TotalSongsCard";
import { TopArtistsCard } from "@/components/TopArtistsCard";
import { TopGenresCard } from "@/components/TopGenresCard";
import { TopTracksCard } from "@/components/TopTracksCard";
import { RecentTracksCard } from "@/components/RecentTracksCard";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Home() {
  const [showDailyMinutes, setShowDailyMinutes] = useState(true);

  const handleToggleDailyMinutes = () => {
    setShowDailyMinutes((previous) => !previous);
  };

  return (
    <section className="grid gap-4 md:grid-cols-4 w-full min-w-0 overflow-x-hidden">
      <TotalMinutesCard
        isOpen={showDailyMinutes}
        onToggle={handleToggleDailyMinutes}
      />
      <TotalSongsCard />
      <Card>
        <CardHeader>
          <CardTitle>Block 3</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Placeholder content</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Block 4</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Placeholder content</p>
        </CardContent>
      </Card>

      {showDailyMinutes ? (
        <DailyMinutesChart className="md:col-span-4" />
      ) : null}

      <div className="md:col-span-4 grid grid-cols-1 md:grid-cols-3 gap-4 w-full min-w-0">
        <TopTracksCard />
        <TopArtistsCard />
        <TopGenresCard />
      </div>

      <RecentTracksCard className="md:col-span-4 w-full min-w-0" />
    </section>
  );
}
