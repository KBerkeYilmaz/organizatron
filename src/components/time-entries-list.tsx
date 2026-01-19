"use client";

import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  DollarSign,
  Loader2,
  Pause,
  Pencil,
  Play,
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { useTimer } from "~/hooks/use-timer";
import { formatDuration, formatRelativeDate } from "~/lib/format";
import { cn } from "~/lib/utils";
import { api, type RouterOutputs } from "~/trpc/react";

type FilteredResult = RouterOutputs["timeEntry"]["getFiltered"];
type TimeEntryGroup = FilteredResult["groups"][number];
type TimePeriodGroup = FilteredResult["timePeriodGroups"][number];

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
  const [expandedPeriods, setExpandedPeriods] = useState<Set<string>>(
    new Set()
  );
  const [editingEntry, setEditingEntry] = useState<EditingEntry | null>(null);
  const [editingTask, setEditingTask] = useState<EditingTask | null>(null);

  const utils = api.useUtils();
  const { switchTask, pause, timerState, isActive: isTimerActive, isRunning } = useTimer();

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

  const updateTaskMutation = api.task.update.useMutation({
    onSuccess: () => {
      toast.success("Task updated");
      void utils.task.getAll.invalidate();
      void utils.timeEntry.getFiltered.invalidate();
      void utils.timeEntry.getRecentGroupedByTask.invalidate();
      setEditingTask(null);
    },
    onError: (error) => {
      toast.error("Failed to update task", {
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

  const togglePeriod = (periodKey: string) => {
    setExpandedPeriods((prev) => {
      const next = new Set(prev);
      if (next.has(periodKey)) {
        next.delete(periodKey);
      } else {
        next.add(periodKey);
      }
      return next;
    });
  };

  const startEditingTask = (task: { id: string; title: string }) => {
    setEditingTask({ id: task.id, title: task.title });
  };

  const handleSaveTask = () => {
    if (!editingTask) return;
    updateTaskMutation.mutate({
      id: editingTask.id,
      title: editingTask.title,
    });
  };

  const handleToggleBillable = (taskId: string, isBillable: boolean) => {
    updateTaskMutation.mutate({
      id: taskId,
      isBillable: !isBillable,
    });
  };

  const handleStartTimer = (task: {
    id: string;
    title: string;
    isBillable: boolean;
    project: {
      id: string;
      name: string;
      client: { id: string; name: string; color: string };
    };
  }) => {
    // Use switchTask to smoothly transition between tasks
    // If a timer is running, it will stop and save it before starting the new one
    switchTask({
      id: task.id,
      title: task.title,
      isBillable: task.isBillable,
      project: {
        id: task.project.id,
        name: task.project.name,
        client: {
          id: task.project.client.id,
          name: task.project.client.name,
          color: task.project.client.color,
        },
      },
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

  // Determine if we should show period-based grouping
  const hasPeriodGrouping =
    data.timeGrouping !== "none" && data.timePeriodGroups.length > 0;

  return (
    <div className="space-y-4">
      {hasPeriodGrouping ? (
        // Period-based view (for week/month)
        <div className="space-y-6">
          {data.timePeriodGroups.map((periodGroup) => (
            <TimePeriodSection
              key={periodGroup.key}
              periodGroup={periodGroup}
              isExpanded={expandedPeriods.has(periodGroup.key)}
              onToggle={() => togglePeriod(periodGroup.key)}
              expandedTasks={expandedTasks}
              onToggleTask={toggleTask}
              editingEntry={editingEntry}
              onStartEditing={startEditing}
              onSave={handleSave}
              onCancelEdit={() => setEditingEntry(null)}
              onDelete={handleDelete}
              onEditChange={setEditingEntry}
              isSaving={updateMutation.isPending}
              isDeleting={deleteMutation.isPending}
              editingTask={editingTask}
              onStartEditingTask={startEditingTask}
              onSaveTask={handleSaveTask}
              onCancelEditTask={() => setEditingTask(null)}
              onEditTaskChange={setEditingTask}
              onToggleBillable={handleToggleBillable}
              onStartTimer={handleStartTimer}
              onPauseTimer={pause}
              isTaskSaving={updateTaskMutation.isPending}
              isTimerActive={isTimerActive}
              isTimerRunning={isRunning}
              activeTaskId={timerState.task?.id ?? null}
            />
          ))}
        </div>
      ) : (
        // Flat task groups (for today/short custom ranges)
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
              editingTask={editingTask}
              onStartEditingTask={startEditingTask}
              onSaveTask={handleSaveTask}
              onCancelEditTask={() => setEditingTask(null)}
              onEditTaskChange={setEditingTask}
              onToggleBillable={handleToggleBillable}
              onStartTimer={handleStartTimer}
              onPauseTimer={pause}
              isTaskSaving={updateTaskMutation.isPending}
              isTimerActive={isTimerActive}
              isTimerRunning={isRunning}
              activeTaskId={timerState.task?.id ?? null}
            />
          ))}
        </div>
      )}

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

interface EditingTask {
  id: string;
  title: string;
}

interface TaskGroupProps {
  group: TimeEntryGroup | {
    task: TimePeriodGroup["entries"][0]["task"];
    entries: TimePeriodGroup["entries"];
    totalDuration: number;
  };
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
  editingTask: EditingTask | null;
  onStartEditingTask: (task: { id: string; title: string }) => void;
  onSaveTask: () => void;
  onCancelEditTask: () => void;
  onEditTaskChange: (task: EditingTask) => void;
  onToggleBillable: (taskId: string, isBillable: boolean) => void;
  onStartTimer: (task: { id: string; title: string; isBillable: boolean; project: { id: string; name: string; client: { id: string; name: string; color: string } } }) => void;
  onPauseTimer: () => void;
  isTaskSaving: boolean;
  isTimerActive: boolean;
  isTimerRunning: boolean;
  activeTaskId: string | null;
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
  editingTask,
  onStartEditingTask,
  onSaveTask,
  onCancelEditTask,
  onEditTaskChange,
  onToggleBillable,
  onStartTimer,
  onPauseTimer,
  isTaskSaving,
  isTimerActive,
  isTimerRunning,
  activeTaskId,
}: TaskGroupProps) {
  const client = group.task?.project?.client;
  const isEditingThisTask = editingTask?.id === group.task.id;
  const isActiveTask = activeTaskId === group.task.id;
  const isActiveAndRunning = isActiveTask && isTimerRunning;

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div
        className={cn(
          "group/taskrow flex w-full items-center rounded-lg border px-4 py-3 text-left transition-colors",
          "hover:bg-muted/50",
          isExpanded && "bg-muted/50 border-b-0 rounded-b-none",
          isActiveTask && "ring-2 ring-primary/50"
        )}
      >
        {/* Left section: chevron + color dot + task info */}
        <CollapsibleTrigger asChild>
          <button className="flex min-w-0 flex-1 items-center gap-3">
            <div className="shrink-0">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            {client && (
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: client.color }}
              />
            )}
            <div className="min-w-0 flex-1">
              {isEditingThisTask ? (
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Input
                    value={editingTask.title}
                    onChange={(e) =>
                      onEditTaskChange({ ...editingTask, title: e.target.value })
                    }
                    className="h-7 text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        onSaveTask();
                      } else if (e.key === "Escape") {
                        onCancelEditTask();
                      }
                    }}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0"
                    onClick={onCancelEditTask}
                    disabled={isTaskSaving}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={onSaveTask}
                    disabled={isTaskSaving}
                  >
                    {isTaskSaving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{group.task.title}</p>
                    {group.task.isBillable && (
                      <DollarSign className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {client?.name} · {group.task.project.name} ·{" "}
                    {group.entries.length} session
                    {group.entries.length !== 1 ? "s" : ""}
                  </p>
                </div>
              )}
            </div>
          </button>
        </CollapsibleTrigger>

        {/* Right section: duration + actions */}
        {!isEditingThisTask && (
          <div className="ml-4 flex shrink-0 items-center gap-2">
            {/* Duration - single line */}
            <div className="flex items-center gap-1.5 text-right">
              <span className="text-sm font-semibold tabular-nums">
                {formatDuration(group.totalDuration)}
              </span>
              <span className="text-xs text-muted-foreground">total</span>
            </div>

            {/* Action buttons - visible on hover */}
            <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/taskrow:opacity-100">
              {/* Play/Pause button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant={isActiveAndRunning ? "default" : "ghost"}
                    className={cn("h-8 w-8", isActiveAndRunning && "bg-primary")}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isActiveAndRunning) {
                        onPauseTimer();
                      } else {
                        onStartTimer(group.task);
                      }
                    }}
                  >
                    {isActiveAndRunning ? (
                      <Pause className="h-4 w-4 text-primary-foreground" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isActiveAndRunning
                    ? "Pause timer"
                    : isTimerActive
                      ? "Switch to this task"
                      : "Start timer"}</TooltipContent>
              </Tooltip>

              {/* Edit task name */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartEditingTask({ id: group.task.id, title: group.task.title });
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit task name</TooltipContent>
              </Tooltip>

              {/* Toggle billable */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className={cn(
                      "h-8 w-8",
                      group.task.isBillable && "text-emerald-600 hover:text-emerald-700"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleBillable(group.task.id, group.task.isBillable);
                    }}
                    disabled={isTaskSaving}
                  >
                    <DollarSign className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {group.task.isBillable ? "Mark as non-billable" : "Mark as billable"}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        )}
      </div>
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

interface TimePeriodSectionProps {
  periodGroup: TimePeriodGroup;
  isExpanded: boolean;
  onToggle: () => void;
  expandedTasks: Set<string>;
  onToggleTask: (taskId: string) => void;
  editingEntry: EditingEntry | null;
  onStartEditing: (entry: {
    id: string;
    startTime: Date;
    endTime: Date | null;
  }) => void;
  onSave: () => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
  onEditChange: (entry: EditingEntry) => void;
  isSaving: boolean;
  isDeleting: boolean;
  editingTask: EditingTask | null;
  onStartEditingTask: (task: { id: string; title: string }) => void;
  onSaveTask: () => void;
  onCancelEditTask: () => void;
  onEditTaskChange: (task: EditingTask) => void;
  onToggleBillable: (taskId: string, isBillable: boolean) => void;
  onStartTimer: (task: { id: string; title: string; isBillable: boolean; project: { id: string; name: string; client: { id: string; name: string; color: string } } }) => void;
  onPauseTimer: () => void;
  isTaskSaving: boolean;
  isTimerActive: boolean;
  isTimerRunning: boolean;
  activeTaskId: string | null;
}

function TimePeriodSection({
  periodGroup,
  isExpanded,
  onToggle,
  expandedTasks,
  onToggleTask,
  editingEntry,
  onStartEditing,
  onSave,
  onCancelEdit,
  onDelete,
  onEditChange,
  isSaving,
  isDeleting,
  editingTask,
  onStartEditingTask,
  onSaveTask,
  onCancelEditTask,
  onEditTaskChange,
  onToggleBillable,
  onStartTimer,
  onPauseTimer,
  isTaskSaving,
  isTimerActive,
  isTimerRunning,
  activeTaskId,
}: TimePeriodSectionProps) {
  // Group entries by task within this period
  const taskGroups = periodGroup.entries.reduce(
    (acc, entry) => {
      const taskId = entry.taskId;
      if (!acc[taskId]) {
        acc[taskId] = {
          task: entry.task,
          entries: [],
          totalDuration: 0,
        };
      }
      acc[taskId]!.entries.push(entry);
      acc[taskId]!.totalDuration += entry.duration;
      return acc;
    },
    {} as Record<
      string,
      {
        task: TimePeriodGroup["entries"][0]["task"];
        entries: TimePeriodGroup["entries"];
        totalDuration: number;
      }
    >
  );

  const sortedTaskGroups = Object.values(taskGroups).sort(
    (a, b) => b.totalDuration - a.totalDuration
  );

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle} defaultOpen>
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            "flex w-full items-center justify-between rounded-lg bg-muted/50 px-4 py-3 text-left transition-colors",
            "hover:bg-muted/70",
            isExpanded && "rounded-b-none"
          )}
        >
          <div className="flex items-center gap-3">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="font-medium">{periodGroup.label}</p>
              <p className="text-xs text-muted-foreground">
                {periodGroup.entries.length} entr
                {periodGroup.entries.length !== 1 ? "ies" : "y"} ·{" "}
                {Object.keys(taskGroups).length} task
                {Object.keys(taskGroups).length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-semibold tabular-nums">
              {formatDuration(periodGroup.totalDuration)}
            </p>
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-2 rounded-b-lg border border-t-0 bg-background p-3">
          {sortedTaskGroups.map((group) => (
            <TaskGroup
              key={`${periodGroup.key}-${group.task.id}`}
              group={group}
              isExpanded={expandedTasks.has(
                `${periodGroup.key}-${group.task.id}`
              )}
              onToggle={() => onToggleTask(`${periodGroup.key}-${group.task.id}`)}
              editingEntry={editingEntry}
              onStartEditing={onStartEditing}
              onSave={onSave}
              onCancelEdit={onCancelEdit}
              onDelete={onDelete}
              onEditChange={onEditChange}
              isSaving={isSaving}
              isDeleting={isDeleting}
              editingTask={editingTask}
              onStartEditingTask={onStartEditingTask}
              onSaveTask={onSaveTask}
              onCancelEditTask={onCancelEditTask}
              onEditTaskChange={onEditTaskChange}
              onToggleBillable={onToggleBillable}
              onStartTimer={onStartTimer}
              onPauseTimer={onPauseTimer}
              isTaskSaving={isTaskSaving}
              isTimerActive={isTimerActive}
              isTimerRunning={isTimerRunning}
              activeTaskId={activeTaskId}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
