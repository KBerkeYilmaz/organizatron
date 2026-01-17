"use client";

import { Clock, Loader2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { formatDuration, formatRelativeDate } from "~/lib/format";
import { api } from "~/trpc/react";

export function RecentActivity() {
  const { data: recentEntries, isLoading } = api.timeEntry.getRecent.useQuery({
    limit: 6,
  });

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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !recentEntries?.length ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No recent activity
          </p>
        ) : (
          Object.entries(groupedByDate).map(([date, entries]) => (
            <div key={date}>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {date}
              </p>
              <div className="space-y-2">
                {entries?.map((entry) => {
                  const client = entry.task?.project?.client;
                  return (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        {client && (
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: client.color }}
                          />
                        )}
                        <div>
                          <p className="text-sm font-medium">
                            {entry.task?.title ?? "Unknown task"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {client?.name}
                            {entry.notes && ` · ${entry.notes}`}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {formatDuration(entry.duration)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
