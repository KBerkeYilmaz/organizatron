"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { formatDuration } from "~/lib/format";
import type { TimePeriod } from "~/lib/types";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

const periods: { value: TimePeriod; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
];

export function ClientTimeSummary() {
  const [period, setPeriod] = useState<TimePeriod>("week");

  const { data: summaries, isLoading: summariesLoading } =
    api.stats.getClientTimeSummaries.useQuery({ period });

  const { data: totalTime, isLoading: totalLoading } =
    api.stats.getTotalTimeForPeriod.useQuery({ period });

  const isLoading = summariesLoading || totalLoading;
  const total = totalTime ?? 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">Time by Client</CardTitle>
          <div className="flex gap-1">
            {periods.map((p) => (
              <Button
                key={p.value}
                variant="ghost"
                size="sm"
                onClick={() => setPeriod(p.value)}
                className={cn(
                  "h-7 px-2 text-xs",
                  period === p.value && "bg-secondary"
                )}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Total */}
        <div className="flex items-center justify-between border-b pb-3">
          <span className="text-sm text-muted-foreground">Total tracked</span>
          <span className="text-lg font-semibold tabular-nums">
            {isLoading ? "..." : formatDuration(total)}
          </span>
        </div>

        {/* Client breakdown */}
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !summaries?.length ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No time tracked for this period
          </p>
        ) : (
          <div className="space-y-2">
            {summaries.map((summary) => {
              const percentage = total > 0 ? (summary.totalTime / total) * 100 : 0;

              return (
                <div key={summary.client.id} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{summary.client.logo ?? "📁"}</span>
                      <span className="text-sm font-medium">
                        {summary.client.name}
                      </span>
                    </div>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {formatDuration(summary.totalTime)}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: summary.client.color,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {summary.projectCount} project{summary.projectCount !== 1 && "s"} ·{" "}
                      {summary.taskCount} task{summary.taskCount !== 1 && "s"}
                    </span>
                    <span>{Math.round(percentage)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
