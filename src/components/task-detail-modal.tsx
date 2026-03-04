"use client";

import { format } from "date-fns";
import {
  Calendar,
  Clock,
  DollarSign,
  Edit2,
  ExternalLink,
  Loader2,
  Tag,
  Timer,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Separator } from "~/components/ui/separator";
import { TaskTimerButton } from "~/components/task-timer-button";
import { AITaskGuidancePanel } from "~/components/ai-task-guidance";
import { formatDuration } from "~/lib/format";
import { cn } from "~/lib/utils";
import type { Priority, TaskStatus } from "~/lib/types";
import type { TimerTask } from "~/store/timer-atoms";
import { api } from "~/trpc/react";

interface TaskDetailModalProps {
  taskId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: () => void;
}

const priorityConfig: Record<Priority, { label: string; className: string }> = {
  low: { label: "Low", className: "bg-muted text-muted-foreground" },
  medium: { label: "Medium", className: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  high: { label: "High", className: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  urgent: { label: "Urgent", className: "bg-red-600/15 text-red-700 dark:text-red-400 font-medium" },
};

const statusConfig: Record<TaskStatus, { label: string; className: string }> = {
  todo: { label: "To Do", className: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400" },
  in_progress: { label: "In Progress", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  completed: { label: "Completed", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  archived: { label: "Archived", className: "bg-zinc-500/10 text-zinc-500" },
};

export function TaskDetailModal({
  taskId,
  open,
  onOpenChange,
  onEdit,
}: TaskDetailModalProps) {
  const router = useRouter();
  const utils = api.useUtils();
  const { data: task, isLoading } = api.task.getById.useQuery(
    { id: taskId },
    { enabled: open && !!taskId }
  );

  // Callback to refresh task data when AI takes actions
  const handleRefreshTask = () => {
    void utils.task.getById.invalidate({ id: taskId });
  };

  const handleNavigate = (href: string) => {
    // Close modal first, then navigate after a brief delay
    // This prevents conflict with router.back() in parent component
    onOpenChange(false);
    setTimeout(() => {
      router.push(href);
    }, 100);
  };

  const totalTimeSpent = task?.timeEntries?.reduce(
    (acc, entry) => acc + entry.duration,
    0
  ) ?? 0;

  // Timer task for the button
  const timerTask: TimerTask | null = task
    ? {
        id: task.id,
        title: task.title,
        project: {
          id: task.project.id,
          name: task.project.name,
          client: {
            id: task.project.client.id,
            name: task.project.client.name,
            color: task.project.client.color,
          },
        },
        isBillable: task.isBillable,
        hourlyRate: task.hourlyRate,
        currency: task.currency,
      }
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {isLoading ? (
          <DialogHeader>
            <DialogTitle className="sr-only">Loading task</DialogTitle>
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </DialogHeader>
        ) : !task ? (
          <DialogHeader>
            <DialogTitle className="sr-only">Task not found</DialogTitle>
            <div className="py-12 text-center">
              <p className="text-muted-foreground">Task not found</p>
            </div>
          </DialogHeader>
        ) : (
          <>
            <DialogHeader className="space-y-3">
              {/* Client/Project breadcrumb */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: task.project.client.color }}
                />
                <span>{task.project.client.name}</span>
                <span>/</span>
                <span>{task.project.name}</span>
              </div>

              <div className="flex items-start justify-between gap-4">
                <DialogTitle className="text-xl font-semibold leading-tight">
                  {task.title}
                </DialogTitle>
                <div className="flex items-center gap-2">
                  {onEdit && (
                    <Button variant="outline" size="sm" onClick={onEdit}>
                      <Edit2 className="mr-1.5 h-3.5 w-3.5" />
                      Edit
                    </Button>
                  )}
                  {timerTask && task.status !== "completed" && (
                    <TaskTimerButton task={timerTask} size="sm" />
                  )}
                </div>
              </div>

              {/* Status and Priority badges */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="secondary"
                  className={cn("text-xs", statusConfig[task.status].className)}
                >
                  {statusConfig[task.status].label}
                </Badge>
                <Badge
                  variant="secondary"
                  className={cn("text-xs", priorityConfig[task.priority].className)}
                >
                  {priorityConfig[task.priority].label}
                </Badge>
                {task.isBillable && (
                  <Badge variant="outline" className="gap-1 text-xs">
                    <DollarSign className="h-3 w-3" />
                    Billable
                  </Badge>
                )}
              </div>
            </DialogHeader>

            <div className="space-y-6 pt-4">
              {/* Description */}
              {task.description && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Description
                  </h3>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {task.description}
                  </p>
                </div>
              )}

              {/* AI Guidance Panel - only show for non-completed tasks */}
              {task.status !== "completed" && task.status !== "archived" && (
                <AITaskGuidancePanel
                  taskId={task.id}
                  taskTitle={task.title}
                  onRefresh={handleRefreshTask}
                />
              )}

              {/* Meta info grid */}
              <div className="grid grid-cols-2 gap-4 rounded-lg border p-4 sm:grid-cols-4">
                {/* Due Date */}
                <div className="space-y-1">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    Due Date
                  </p>
                  <p className="text-sm font-medium">
                    {task.dueDate
                      ? format(new Date(task.dueDate), "MMM d, yyyy")
                      : "Not set"}
                  </p>
                </div>

                {/* Estimated Time */}
                <div className="space-y-1">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    Estimated
                  </p>
                  <p className="text-sm font-medium">
                    {task.estimatedTime
                      ? formatDuration(task.estimatedTime)
                      : "Not set"}
                  </p>
                </div>

                {/* Time Spent */}
                <div className="space-y-1">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Timer className="h-3.5 w-3.5" />
                    Time Spent
                  </p>
                  <p className="text-sm font-medium">
                    {totalTimeSpent > 0
                      ? formatDuration(totalTimeSpent)
                      : "No time logged"}
                  </p>
                </div>

                {/* Sessions */}
                <div className="space-y-1">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    Sessions
                  </p>
                  <p className="text-sm font-medium">
                    {task.timeEntries?.length ?? 0}
                  </p>
                </div>
              </div>

              {/* Tags */}
              {task.tags.length > 0 && (
                <div className="space-y-2">
                  <h3 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                    <Tag className="h-3.5 w-3.5" />
                    Tags
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {task.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md bg-muted px-2 py-0.5 text-xs"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Billing Info */}
              {task.isBillable && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h3 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                      <DollarSign className="h-3.5 w-3.5" />
                      Billing Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">
                          Hourly Rate
                        </p>
                        <p className="text-sm font-medium">
                          {task.hourlyRate
                            ? `${(task.hourlyRate / 100).toFixed(2)} ${task.currency}`
                            : "Not set"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">
                          Billable Amount
                        </p>
                        <p className="text-sm font-medium">
                          {task.hourlyRate && totalTimeSpent > 0
                            ? `${((task.hourlyRate / 100) * (totalTimeSpent / 3600)).toFixed(2)} ${task.currency}`
                            : "—"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">
                          Payment Status
                        </p>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-xs",
                            task.billingStatus === "paid"
                              ? "bg-emerald-500/10 text-emerald-600"
                              : "bg-amber-500/10 text-amber-600"
                          )}
                        >
                          {task.billingStatus === "paid" ? "Paid" : "Pending"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Time Entries */}
              {task.timeEntries && task.timeEntries.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h3 className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Timer className="h-3.5 w-3.5" />
                        Recent Time Entries
                      </span>
                      <button
                        onClick={() => handleNavigate(`/time-entries?taskId=${task.id}`)}
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        View all
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    </h3>
                    <div className="space-y-2">
                      {task.timeEntries.slice(0, 5).map((entry) => (
                        <div
                          key={entry.id}
                          className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(entry.startTime), "MMM d")}
                            </span>
                            <span>
                              {format(new Date(entry.startTime), "h:mm a")}
                              {entry.endTime && (
                                <>
                                  {" → "}
                                  {format(new Date(entry.endTime), "h:mm a")}
                                </>
                              )}
                            </span>
                          </div>
                          <span className="font-medium tabular-nums">
                            {formatDuration(entry.duration)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Created/Completed dates */}
              <div className="flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
                <span>Created {format(new Date(task.createdAt), "MMM d, yyyy")}</span>
                {task.completedAt && (
                  <span>
                    Completed {format(new Date(task.completedAt), "MMM d, yyyy")}
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
