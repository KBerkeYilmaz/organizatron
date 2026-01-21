"use client";

import { format } from "date-fns";
import {
  ArrowLeft,
  Calendar,
  Clock,
  DollarSign,
  Edit2,
  ExternalLink,
  Loader2,
  Tag,
  Timer,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { PageHeader } from "~/components/page-header";
import { TaskDialog } from "~/components/task-dialog";
import { TaskTimerButton } from "~/components/task-timer-button";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { formatDuration } from "~/lib/format";
import { cn } from "~/lib/utils";
import type { Priority, TaskStatus } from "~/lib/types";
import type { TimerTask } from "~/store/timer-atoms";
import { api } from "~/trpc/react";

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

export default function TaskDetailPage() {
  const params = useParams<{ taskId: string }>();
  const router = useRouter();
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const { data: task, isLoading } = api.task.getById.useQuery(
    { id: params.taskId },
    { enabled: !!params.taskId }
  );

  const totalTimeSpent =
    task?.timeEntries?.reduce((acc, entry) => acc + entry.duration, 0) ?? 0;

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

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Task not found</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={task.title}
        subtitle={`${task.project.client.name} / ${task.project.name}`}
      />

      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Back button and actions */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditDialogOpen(true)}
              >
                <Edit2 className="mr-1.5 h-3.5 w-3.5" />
                Edit
              </Button>
              {timerTask && task.status !== "completed" && (
                <TaskTimerButton task={timerTask} size="sm" />
              )}
            </div>
          </div>

          {/* Status and Priority badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: task.project.client.color }}
            />
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

          {/* Description */}
          {task.description && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {task.description}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Meta info grid */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  Due Date
                </p>
                <p className="mt-1 text-sm font-medium">
                  {task.dueDate
                    ? format(new Date(task.dueDate), "MMM d, yyyy")
                    : "Not set"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  Estimated
                </p>
                <p className="mt-1 text-sm font-medium">
                  {task.estimatedTime
                    ? formatDuration(task.estimatedTime)
                    : "Not set"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Timer className="h-3.5 w-3.5" />
                  Time Spent
                </p>
                <p className="mt-1 text-sm font-medium">
                  {totalTimeSpent > 0 ? formatDuration(totalTimeSpent) : "—"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  Sessions
                </p>
                <p className="mt-1 text-sm font-medium">
                  {task.timeEntries?.length ?? 0}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tags */}
          {task.tags.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-1.5 text-sm font-medium">
                  <Tag className="h-3.5 w-3.5" />
                  Tags
                </CardTitle>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
          )}

          {/* Billing Info */}
          {task.isBillable && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-1.5 text-sm font-medium">
                  <DollarSign className="h-3.5 w-3.5" />
                  Billing Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Hourly Rate</p>
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
              </CardContent>
            </Card>
          )}

          {/* Time Entries */}
          {task.timeEntries && task.timeEntries.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-sm font-medium">
                  <span className="flex items-center gap-1.5">
                    <Timer className="h-3.5 w-3.5" />
                    Time Entries
                  </span>
                  <Link
                    href={`/time-entries?taskId=${task.id}`}
                    className="flex items-center gap-1 text-xs font-normal text-primary hover:underline"
                  >
                    View all
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {task.timeEntries.map((entry) => (
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
              </CardContent>
            </Card>
          )}

          {/* Created/Completed dates */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Created {format(new Date(task.createdAt), "MMM d, yyyy")}</span>
            {task.completedAt && (
              <span>
                Completed {format(new Date(task.completedAt), "MMM d, yyyy")}
              </span>
            )}
          </div>
        </div>
      </main>

      {/* Edit Dialog */}
      <TaskDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        task={{
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          projectId: task.projectId,
          estimatedTime: task.estimatedTime,
          dueDate: task.dueDate,
          scheduledStart: task.scheduledStart,
          tags: task.tags,
          isBillable: task.isBillable,
          hourlyRate: task.hourlyRate,
          currency: task.currency,
          billingStatus: task.billingStatus,
          project: task.project,
        }}
      />
    </>
  );
}
