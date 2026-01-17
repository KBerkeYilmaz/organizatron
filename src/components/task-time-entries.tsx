"use client";

import {
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  Pencil,
  Trash2,
  X,
  Check,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { Input } from "~/components/ui/input";
import { formatDuration, formatRelativeDate } from "~/lib/format";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

interface TaskTimeEntriesProps {
  className?: string;
}

interface EditingEntry {
  id: string;
  startTime: string;
  endTime: string;
}

export function TaskTimeEntries({ className }: TaskTimeEntriesProps) {
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [editingEntry, setEditingEntry] = useState<EditingEntry | null>(null);

  const utils = api.useUtils();

  const { data: groupedEntries, isLoading } =
    api.timeEntry.getRecentGroupedByTask.useQuery({
      limit: 5,
      days: 7,
    });

  const updateMutation = api.timeEntry.update.useMutation({
    onSuccess: () => {
      toast.success("Time entry updated");
      void utils.timeEntry.getRecentGroupedByTask.invalidate();
      void utils.timeEntry.getRecent.invalidate();
      void utils.stats.invalidate();
      setEditingEntry(null);
    },
    onError: (error) => {
      toast.error("Failed to update time entry", {
        description: error.message,
      });
    },
  });

  const deleteMutation = api.timeEntry.delete.useMutation({
    onSuccess: () => {
      toast.success("Time entry deleted");
      void utils.timeEntry.getRecentGroupedByTask.invalidate();
      void utils.timeEntry.getRecent.invalidate();
      void utils.stats.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to delete time entry", {
        description: error.message,
      });
    },
  });

  const toggleTask = (taskId: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const startEditing = (entry: {
    id: string;
    startTime: Date;
    endTime: Date | null;
  }) => {
    setEditingEntry({
      id: entry.id,
      startTime: formatDateTimeLocal(new Date(entry.startTime)),
      endTime: entry.endTime
        ? formatDateTimeLocal(new Date(entry.endTime))
        : "",
    });
  };

  const handleSave = () => {
    if (!editingEntry) return;

    const startTime = new Date(editingEntry.startTime);
    const endTime = editingEntry.endTime
      ? new Date(editingEntry.endTime)
      : null;

    if (endTime && startTime >= endTime) {
      toast.error("Invalid time range", {
        description: "Start time must be before end time",
      });
      return;
    }

    const duration = endTime
      ? Math.floor((endTime.getTime() - startTime.getTime()) / 1000)
      : 0;

    updateMutation.mutate({
      id: editingEntry.id,
      startTime,
      endTime,
      duration,
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this time entry?")) {
      deleteMutation.mutate({ id });
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Working Periods
          <span className="text-xs font-normal text-muted-foreground">
            (Last 7 days)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !groupedEntries?.length ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No time entries this week
          </p>
        ) : (
          groupedEntries.map((group) => {
            const client = group.task?.project?.client;
            const isExpanded = expandedTasks.has(group.task.id);

            return (
              <Collapsible
                key={group.task.id}
                open={isExpanded}
                onOpenChange={() => toggleTask(group.task.id)}
              >
                <CollapsibleTrigger asChild>
                  <button
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors",
                      "hover:bg-muted/50",
                      isExpanded && "bg-muted/50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      {client && (
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: client.color }}
                        />
                      )}
                      <div>
                        <p className="text-sm font-medium">{group.task.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {client?.name} · {group.task.project.name} ·{" "}
                          {group.entries.length} session
                          {group.entries.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">
                        {formatDuration(group.totalDuration)}
                      </p>
                      <p className="text-xs text-muted-foreground">total</p>
                    </div>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-7 space-y-1 border-l-2 border-muted py-2 pl-4">
                    {group.entries.map((entry) => {
                      const isEditing = editingEntry?.id === entry.id;

                      if (isEditing) {
                        return (
                          <div
                            key={entry.id}
                            className="flex flex-col gap-2 rounded-lg bg-muted/50 p-3"
                          >
                            <div className="flex items-center gap-2">
                              <div className="flex-1">
                                <label className="text-xs text-muted-foreground">
                                  Start Time
                                </label>
                                <Input
                                  type="datetime-local"
                                  value={editingEntry.startTime}
                                  onChange={(e) =>
                                    setEditingEntry({
                                      ...editingEntry,
                                      startTime: e.target.value,
                                    })
                                  }
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div className="flex-1">
                                <label className="text-xs text-muted-foreground">
                                  End Time
                                </label>
                                <Input
                                  type="datetime-local"
                                  value={editingEntry.endTime}
                                  onChange={(e) =>
                                    setEditingEntry({
                                      ...editingEntry,
                                      endTime: e.target.value,
                                    })
                                  }
                                  className="h-8 text-sm"
                                />
                              </div>
                            </div>
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingEntry(null)}
                                disabled={updateMutation.isPending}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                onClick={handleSave}
                                disabled={updateMutation.isPending}
                              >
                                {updateMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={entry.id}
                          className="group flex items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-muted/30"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {formatRelativeDate(entry.startTime)}
                            </span>
                            <span className="text-xs font-medium">
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
                                  {new Date(entry.endTime).toLocaleTimeString(
                                    "en-US",
                                    {
                                      hour: "numeric",
                                      minute: "2-digit",
                                      hour12: true,
                                    }
                                  )}
                                </>
                              )}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="tabular-nums text-muted-foreground">
                              {formatDuration(entry.duration)}
                            </span>
                            <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditing(entry);
                                }}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-destructive hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(entry.id);
                                }}
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function formatDateTimeLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
