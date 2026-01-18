"use client";

import {
  ChevronDown,
  ChevronRight,
  Clock,
  DollarSign,
  Loader2,
  Pencil,
  Trash2,
  X,
  Check,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { Input } from "~/components/ui/input";
import { formatDuration, formatRelativeDate } from "~/lib/format";
import { cn } from "~/lib/utils";
import { api, type RouterOutputs } from "~/trpc/react";

type FilteredResult = RouterOutputs["timeEntry"]["getFiltered"];
type TimeEntryGroup = FilteredResult["groups"][number];

interface TimeEntriesListProps {
  data: FilteredResult | undefined;
  isLoading: boolean;
}

interface EditingEntry {
  id: string;
  startTime: string;
  endTime: string;
}

export function TimeEntriesList({ data, isLoading }: TimeEntriesListProps) {
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [editingEntry, setEditingEntry] = useState<EditingEntry | null>(null);

  const utils = api.useUtils();

  const updateMutation = api.timeEntry.update.useMutation({
    onSuccess: () => {
      toast.success("Time entry updated");
      void utils.timeEntry.getFiltered.invalidate();
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
      void utils.timeEntry.getFiltered.invalidate();
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data?.groups.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Clock className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-lg">No Time Entries</h3>
        <p className="text-sm text-muted-foreground max-w-[300px] mt-1">
          No time entries found for the selected period and filters.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Task groups */}
      <div className="space-y-2">
        {data.groups.map((group) => (
          <TaskGroup
            key={group.task.id}
            group={group}
            isExpanded={expandedTasks.has(group.task.id)}
            onToggle={() => toggleTask(group.task.id)}
            editingEntry={editingEntry}
            onStartEditing={startEditing}
            onSave={handleSave}
            onCancelEdit={() => setEditingEntry(null)}
            onDelete={handleDelete}
            onEditChange={setEditingEntry}
            isSaving={updateMutation.isPending}
            isDeleting={deleteMutation.isPending}
          />
        ))}
      </div>

      {/* Summary footer */}
      <Card className="bg-muted/30">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-xs text-muted-foreground">Total Time</p>
                <p className="text-lg font-bold tabular-nums">
                  {formatDuration(data.summary.totalDuration)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Billable Time</p>
                <p className="text-lg font-bold tabular-nums text-emerald-600">
                  {formatDuration(data.summary.billableDuration)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <span>{data.summary.entryCount} entries</span>
              <span>{data.summary.taskCount} tasks</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface TaskGroupProps {
  group: TimeEntryGroup;
  isExpanded: boolean;
  onToggle: () => void;
  editingEntry: EditingEntry | null;
  onStartEditing: (entry: { id: string; startTime: Date; endTime: Date | null }) => void;
  onSave: () => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
  onEditChange: (entry: EditingEntry) => void;
  isSaving: boolean;
  isDeleting: boolean;
}

function TaskGroup({
  group,
  isExpanded,
  onToggle,
  editingEntry,
  onStartEditing,
  onSave,
  onCancelEdit,
  onDelete,
  onEditChange,
  isSaving,
  isDeleting,
}: TaskGroupProps) {
  const client = group.task?.project?.client;

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            "flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors",
            "hover:bg-muted/50",
            isExpanded && "bg-muted/50 border-b-0 rounded-b-none"
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
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{group.task.title}</p>
                {group.task.isBillable && (
                  <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                )}
              </div>
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
        <div className="border border-t-0 rounded-b-lg bg-background">
          <div className="divide-y">
            {group.entries.map((entry) => {
              const isEditing = editingEntry?.id === entry.id;

              if (isEditing) {
                return (
                  <div
                    key={entry.id}
                    className="flex flex-col gap-2 p-4 bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="text-xs text-muted-foreground">
                          Start Time
                        </label>
                        <Input
                          type="datetime-local"
                          value={editingEntry.startTime}
                          onChange={(e) =>
                            onEditChange({
                              ...editingEntry,
                              startTime: e.target.value,
                            })
                          }
                          className="h-9"
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
                            onEditChange({
                              ...editingEntry,
                              endTime: e.target.value,
                            })
                          }
                          className="h-9"
                        />
                      </div>
                      <div className="flex items-end gap-1 pb-0.5">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={onCancelEdit}
                          disabled={isSaving}
                          className="h-9 w-9"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          onClick={onSave}
                          disabled={isSaving}
                          className="h-9 w-9"
                        >
                          {isSaving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={entry.id}
                  className="group flex items-center justify-between px-4 py-3 hover:bg-muted/30"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground w-20">
                      {formatRelativeDate(entry.startTime)}
                    </span>
                    <span className="text-sm font-medium">
                      {new Date(entry.startTime).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      })}
                      {entry.endTime && (
                        <>
                          <span className="text-muted-foreground mx-1">→</span>
                          {new Date(entry.endTime).toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                          })}
                        </>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums text-sm text-muted-foreground">
                      {formatDuration(entry.duration)}
                    </span>
                    <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          onStartEditing(entry);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(entry.id);
                        }}
                        disabled={isDeleting}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
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
