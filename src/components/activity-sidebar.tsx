"use client";

import { Activity, Clock, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";

import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { formatDuration, formatRelativeDate } from "~/lib/format";
import { api } from "~/trpc/react";

interface ActivitySidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ActivitySidebar({ open, onOpenChange }: ActivitySidebarProps) {
  const { data: recentEntries, isLoading } = api.timeEntry.getRecent.useQuery(
    { limit: 15 },
    { enabled: open }
  );

  // Group by date
  const groupedByDate = (recentEntries ?? []).reduce(
    (acc, entry) => {
      const dateKey = formatRelativeDate(entry.startTime);
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(entry);
      return acc;
    },
    {} as Record<string, typeof recentEntries>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:max-w-[400px] p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activity
          </SheetTitle>
          <SheetDescription>
            Your latest time tracking sessions
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 h-[calc(100vh-180px)]">
          <div className="p-4 space-y-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !recentEntries?.length ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Clock className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm font-medium">No recent activity</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Start a timer to track your work
                </p>
              </div>
            ) : (
              Object.entries(groupedByDate).map(([date, entries]) => (
                <div key={date}>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {date}
                  </p>
                  <div className="space-y-2">
                    {entries?.map((entry) => {
                      const client = entry.task?.project?.client;
                      return (
                        <div
                          key={entry.id}
                          className="group rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                              {client && (
                                <span
                                  className="mt-1.5 h-2.5 w-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: client.color }}
                                />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">
                                  {entry.task?.title ?? "Unknown task"}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {client?.name} · {entry.task?.project?.name}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {new Date(entry.startTime).toLocaleTimeString(
                                    "en-US",
                                    {
                                      hour: "numeric",
                                      minute: "2-digit",
                                      hour12: true,
                                    }
                                  )}
                                  {entry.endTime && (
                                    <>
                                      {" → "}
                                      {new Date(
                                        entry.endTime
                                      ).toLocaleTimeString("en-US", {
                                        hour: "numeric",
                                        minute: "2-digit",
                                        hour12: true,
                                      })}
                                    </>
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-sm font-semibold tabular-nums">
                                {formatDuration(entry.duration)}
                              </span>
                            </div>
                          </div>
                          {entry.notes && (
                            <p className="mt-2 text-xs text-muted-foreground italic border-t pt-2">
                              {entry.notes}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Footer with link to full time entries */}
        <div className="border-t p-4">
          <Button
            variant="outline"
            className="w-full"
            asChild
            onClick={() => onOpenChange(false)}
          >
            <Link href="/time-entries">
              <ExternalLink className="h-4 w-4 mr-2" />
              View All Time Entries
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
