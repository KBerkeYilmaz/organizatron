"use client";

import { Clock } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { formatDuration, formatRelativeDate, formatTime } from "~/lib/format";
import { getClientForProject, getProject, getTask, timeEntries } from "~/lib/data/mock";

export function RecentActivity() {
  // Get task details for each entry (take last 6)
  const recentEntries = timeEntries.slice(0, 6);
  const entriesWithDetails = recentEntries.map((entry) => {
    const task = getTask(entry.taskId);
    const project = task ? getProject(task.projectId) : null;
    const client = task ? getClientForProject(task.projectId) : null;
    return { ...entry, task, project, client };
  });

  // Group by date
  const groupedByDate = entriesWithDetails.reduce(
    (acc, entry) => {
      const dateKey = formatRelativeDate(entry.startTime);
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(entry);
      return acc;
    },
    {} as Record<string, typeof entriesWithDetails>
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
        {Object.entries(groupedByDate).map(([date, entries]) => (
          <div key={date}>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {date}
            </p>
            <div className="space-y-2">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    {entry.client && (
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: entry.client.color }}
                      />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {entry.task?.title ?? "Unknown task"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {entry.client?.name}
                        {entry.notes && ` · ${entry.notes}`}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {formatDuration(entry.duration)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
