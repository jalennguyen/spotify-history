"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { getDailyListeningTotals } from "@/lib/queries";

type TimeRange = "90d" | "30d" | "7d";

type ChartDatum = {
  date: string;
  minutes: number;
};

const chartConfig = {
  minutes: {
    label: "Minutes",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

export function DailyMinutesChart({ className }: { className?: string }) {
  const [timeRange, setTimeRange] = React.useState<TimeRange>("90d");
  const [isMounted, setIsMounted] = React.useState(false);
  const [chartData, setChartData] = React.useState<ChartDatum[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  React.useEffect(() => {
    async function fetchDailyData() {
      try {
        setIsLoading(true);
        setError(null);
        const dailyData = await getDailyListeningTotals();

        // Helper to normalize date to YYYY-MM-DD format
        const normalizeDateString = (dateInput: string | Date): string => {
          // If it's already a YYYY-MM-DD string, return it directly
          if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
            return dateInput;
          }
          // If it's an ISO date string (e.g., "2024-01-15T00:00:00Z"), extract just the date part
          if (typeof dateInput === 'string' && dateInput.includes('T')) {
            return dateInput.split('T')[0];
          }
          // If it's a date string in another format, parse it using UTC to avoid timezone issues
          if (typeof dateInput === 'string') {
            const date = new Date(dateInput);
            const year = date.getUTCFullYear();
            const month = String(date.getUTCMonth() + 1).padStart(2, '0');
            const day = String(date.getUTCDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          }
          // If it's a Date object, use UTC methods to avoid timezone issues
          const year = dateInput.getUTCFullYear();
          const month = String(dateInput.getUTCMonth() + 1).padStart(2, '0');
          const day = String(dateInput.getUTCDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };

        // Transform data to chart format: { date: string, minutes: number }
        // Database returns play_date as YYYY-MM-DD string, use it directly
        const transformed = dailyData.map((item) => ({
          date: String(item.play_date), // Use database date string directly
          minutes: Math.round(item.total_minutes * 100) / 100, // Round to 2 decimal places
        }));

        setChartData(transformed);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load chart data");
        console.error("Error fetching daily listening totals:", err);
      } finally {
        setIsLoading(false);
      }
    }

    if (isMounted) {
      fetchDailyData();
    }
  }, [isMounted]);

  // Helper function to normalize date to YYYY-MM-DD format
  const normalizeDate = React.useCallback((dateInput: string | Date): string => {
    // If it's already a YYYY-MM-DD string, return it directly
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      return dateInput;
    }
    // If it's an ISO date string (e.g., "2024-01-15T00:00:00Z"), extract just the date part
    if (typeof dateInput === 'string' && dateInput.includes('T')) {
      return dateInput.split('T')[0];
    }
    // For Date objects (used in date range generation), use local methods
    // since we've already set hours to 0 in local time
    if (dateInput instanceof Date) {
      const year = dateInput.getFullYear();
      const month = String(dateInput.getMonth() + 1).padStart(2, '0');
      const day = String(dateInput.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    // For other string formats, parse and use local date (database dates should already be YYYY-MM-DD)
    const date = new Date(dateInput);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  // Calculate today's minutes
  // Use UTC date to match database timezone
  const todayMinutes = React.useMemo(() => {
    if (chartData.length === 0) return null;

    const today = new Date();
    // Use UTC to match database timezone (database uses UTC for date_trunc)
    const todayKey = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;

    const todayData = chartData.find((point) => normalizeDate(point.date) === todayKey);
    return todayData ? todayData.minutes : 0;
  }, [chartData, normalizeDate]);

  const filteredData = React.useMemo(() => {
    if (chartData.length === 0) return [];

    const days = timeRange === "90d" ? 90 : timeRange === "30d" ? 30 : 7;

    // Get today's date in UTC to match database timezone
    // Database uses UTC for date_trunc('day', played_at)
    const today = new Date();
    const todayKey = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;

    // Find the maximum date from the actual data
    const maxDataDate = chartData.reduce((max, point) => {
      const dateKey = normalizeDate(point.date);
      return dateKey > max ? dateKey : max;
    }, '');

    // Use the later of today or maxDataDate as the end date
    const endDateKey = todayKey > maxDataDate ? todayKey : maxDataDate;

    // Calculate start date (using UTC to match database)
    const endDateObj = new Date(endDateKey + 'T00:00:00Z'); // Use Z to indicate UTC
    const startDate = new Date(endDateObj);
    startDate.setUTCDate(startDate.getUTCDate() - days + 1); // +1 to include both start and end days

    // Create a map of existing data by date string (YYYY-MM-DD)
    const dataMap = new Map<string, number>();
    chartData.forEach((point) => {
      const dateKey = normalizeDate(point.date);
      dataMap.set(dateKey, point.minutes);
    });

    // Generate complete date range and fill in missing days with zero
    const completeData: ChartDatum[] = [];
    const currentDate = new Date(startDate);

    // Loop through all dates from startDate through endDateKey (inclusive)
    // Use UTC methods to match database timezone
    while (true) {
      const dateKey = `${currentDate.getUTCFullYear()}-${String(currentDate.getUTCMonth() + 1).padStart(2, '0')}-${String(currentDate.getUTCDate()).padStart(2, '0')}`;

      // Stop if we've passed the end date
      if (dateKey > endDateKey) {
        break;
      }

      completeData.push({
        date: dateKey,
        minutes: dataMap.get(dateKey) ?? 0,
      });

      // Stop after adding the end date
      if (dateKey === endDateKey) {
        break;
      }

      // Move to next day (using UTC)
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    // Ensure today is always included and is the last item
    // Sort by date to ensure proper ordering
    completeData.sort((a, b) => a.date.localeCompare(b.date));

    // Remove today if it exists (we'll add it at the end)
    const withoutToday = completeData.filter((item) => normalizeDate(item.date) !== todayKey);

    // Always add today as the last item
    const todayMinutes = dataMap.get(todayKey) ?? 0;
    const finalData = [...withoutToday, {
      date: todayKey,
      minutes: todayMinutes,
    }];

    return finalData;
  }, [timeRange, chartData, normalizeDate]);

  return (
    <Card className={cn("@container/card pt-0", className)}>
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1">
          <CardTitle>Minutes Listened</CardTitle>
          <CardDescription>
            Daily totals based on your synced listening history.
          </CardDescription>
        </div>
        <Select value={timeRange} onValueChange={(value) => setTimeRange(value as TimeRange)}>
          <SelectTrigger className="hidden w-[160px] rounded-lg sm:ml-auto sm:flex">
            <SelectValue placeholder="Select range" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="90d" className="rounded-lg">
              Last 90 days
            </SelectItem>
            <SelectItem value="30d" className="rounded-lg">
              Last 30 days
            </SelectItem>
            <SelectItem value="7d" className="rounded-lg">
              Last 7 days
            </SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <div className="aspect-auto h-[260px] w-full">
          {!isMounted || isLoading ? (
            <div className="flex h-full w-full items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
              Loading chart...
            </div>
          ) : error ? (
            <div className="flex h-full w-full items-center justify-center rounded-lg border border-dashed text-sm text-destructive">
              {error}
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex h-full w-full items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
              No data available for the selected time range
            </div>
          ) : (
            <ChartContainer
              config={chartConfig}
              className="aspect-auto h-full w-full"
            >
              <BarChart
                accessibilityLayer
                data={filteredData}
                margin={{
                  left: 12,
                  right: 24,
                }}
              >
                <CartesianGrid vertical={false} strokeDasharray="4 4" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={32}
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(value) => {
                    // value is already YYYY-MM-DD from the database, just format it for display
                    const dateStr = String(value);
                    const [year, month, day] = dateStr.split('-');
                    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                    return date.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    });
                  }}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      indicator="line"
                      labelFormatter={(value) => {
                        // value is already YYYY-MM-DD from the database, just format it for display
                        const dateStr = String(value);
                        const [year, month, day] = dateStr.split('-');
                        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                        return date.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        });
                      }}
                      valueFormatter={(value) => {
                        // Round to integer
                        return Math.round(Number(value)).toLocaleString();
                      }}
                    />
                  }
                />
                <Bar
                  dataKey="minutes"
                  fill="var(--color-minutes)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
