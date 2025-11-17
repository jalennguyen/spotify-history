"use client";

import * as React from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getRecentTracks, RecentTrack } from "@/lib/queries";

export const columns: ColumnDef<RecentTrack>[] = [
  {
    accessorKey: "track_name",
    header: "Track",
    size: 220,
    cell: ({ row }) => (
      <div className="truncate font-medium text-muted-foreground">
        {row.getValue("track_name")}
      </div>
    ),
  },
  {
    accessorKey: "artist_names",
    header: "Artist(s)",
    size: 200,
    cell: ({ row }) => (
      <div className="truncate text-muted-foreground">
        {row.getValue("artist_names") || "Unknown"}
      </div>
    ),
  },
  {
    accessorKey: "album_name",
    header: "Album",
    size: 220,
    cell: ({ row }) => (
      <div className="truncate text-muted-foreground">{row.getValue("album_name")}</div>
    ),
  },
  {
    accessorKey: "played_at",
    header: "Played At",
    size: 180,
    cell: ({ row }) => {
      const playedAt = row.getValue("played_at") as string;
      return (
        <div className="text-muted-foreground whitespace-nowrap">
          {new Date(playedAt).toLocaleString()}
        </div>
      );
    },
  },
];

export function RecentTracksCard({
  className,
  limit = 50,
}: {
  className?: string;
  limit?: number;
}) {
  const [tracks, setTracks] = React.useState<RecentTrack[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function fetchRecent() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getRecentTracks(limit);
        setTracks(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
        console.error("Error fetching recent tracks:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchRecent();
  }, [limit]);

  const table = useReactTable({
    data: tracks,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableColumnResizing: false,
    columnResizeMode: "onChange",
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle>Recently Played</CardTitle>
        <CardDescription>Latest tracks with artist, album, and time</CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="text-destructive text-sm py-4">{error}</div>
        ) : isLoading ? (
          <div className="text-muted-foreground text-sm py-4">Loading...</div>
        ) : tracks.length === 0 ? (
          <div className="text-muted-foreground text-sm py-4">No recent tracks</div>
        ) : (
          <div className="w-full">
            <div className="rounded-md border overflow-x-auto">
              <style dangerouslySetInnerHTML={{__html: `
                .recent-tracks-table table {
                  table-layout: fixed;
                  width: 100%;
                }
              `}} />
              <div className="recent-tracks-table" style={{ minWidth: "820px" }}>
                <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => {
                        return (
                          <TableHead 
                            key={header.id} 
                            className="pl-4"
                            style={{ width: `${header.column.getSize()}px`, minWidth: `${header.column.getSize()}px` }}
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && "selected"}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell 
                            key={cell.id} 
                            className="py-3 pl-4"
                            style={{ width: `${cell.column.getSize()}px`, minWidth: `${cell.column.getSize()}px` }}
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        className="h-24 text-center"
                      >
                        No results.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              </div>
            </div>
            <div className="flex items-center justify-center py-4">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        table.previousPage();
                      }}
                      className={
                        !table.getCanPreviousPage()
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                  {(() => {
                    const currentPage = table.getState().pagination.pageIndex + 1;
                    const totalPages = table.getPageCount();
                    const pages: (number | "ellipsis")[] = [];

                    if (totalPages <= 7) {
                      // Show all pages if 7 or fewer
                      for (let i = 1; i <= totalPages; i++) {
                        pages.push(i);
                      }
                    } else {
                      // Always show first page
                      pages.push(1);

                      if (currentPage <= 3) {
                        // Near the start
                        for (let i = 2; i <= 4; i++) {
                          pages.push(i);
                        }
                        pages.push("ellipsis");
                        pages.push(totalPages);
                      } else if (currentPage >= totalPages - 2) {
                        // Near the end
                        pages.push("ellipsis");
                        for (let i = totalPages - 3; i <= totalPages; i++) {
                          pages.push(i);
                        }
                      } else {
                        // In the middle
                        pages.push("ellipsis");
                        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                          pages.push(i);
                        }
                        pages.push("ellipsis");
                        pages.push(totalPages);
                      }
                    }

                    return pages.map((page, index) => {
                      if (page === "ellipsis") {
                        return (
                          <PaginationItem key={`ellipsis-${index}`}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        );
                      }
                      return (
                        <PaginationItem key={page}>
                          <PaginationLink
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              table.setPageIndex(page - 1);
                            }}
                            isActive={currentPage === page}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    });
                  })()}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        table.nextPage();
                      }}
                      className={
                        !table.getCanNextPage()
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
