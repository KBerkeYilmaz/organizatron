"use client";

import { Calendar, Clock, MoreHorizontal, Pencil, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useTimer } from "~/hooks/use-timer";
import { formatDuration } from "~/lib/format";
import { cn } from "~/lib/utils";
import type { Priority } from "~/lib/types";
import type { TimerTask } from "~/store/timer-atoms";
import { api } from "~/trpc/react";

// Task with included project and client from tRPC
interface TaskWithRelations {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "completed" | "archived";
  priority: Priority;
  estimatedTime: number | null;
  dueDate: Date | null;
  tags: string[];
  createdAt: Date;
  completedAt: Date | null;
  // Billing
  isBillable: boolean;
  hourlyRate: number | null;
  currency: string;
  billingStatus: "pending" | "paid";
  project: {
    id: string;
    name: string;
    client: {
      id: string;
      name: string;
      color: string;
      logo: string | null;
    };
  };
}

interface TaskCardProps {
  task: TaskWithRelations;
  compact?: boolean;
  onEdit?: (task: TaskWithRelations) => void;
}

const priorityConfig: Record<
  Priority,
  { label: string; className: string }
> = {
  low: {
    label: "Low",
    className: "bg-muted text-muted-foreground",
  },
  medium: {
    label: "Medium",
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  high: {
    label: "High",
    className: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
  urgent: {
    label: "Urgent",
    className: "bg-red-600/15 text-red-700 dark:text-red-400 font-medium",
  },
};

export function TaskCard({ task, compact = false, onEdit }: TaskCardProps) {
  const project = task.project;
  const client = task.project.client;
  const priority = priorityConfig[task.priority];
  const { start } = useTimer();
  const utils = api.useUtils();

  const deleteMutation = api.task.delete.useMutation({
    onSuccess: () => {
      void utils.task.getAll.invalidate();
      toast.success("Task deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete task", { description: error.message });
    },
  });

  const handleStartTimer = () => {
    const timerTask: TimerTask = {
      id: task.id,
      title: task.title,
      project: {
        id: project.id,
        name: project.name,
        client: {
          id: client.id,
          name: client.name,
          color: client.color,
        },
      },
      isBillable: task.isBillable,
      hourlyRate: task.hourlyRate,
      currency: task.currency,
    };
    start(timerTask);
  };

  const handleDelete = () => {
    if (confirm(`Delete "${task.title}"?`)) {
      deleteMutation.mutate({ id: task.id });
    }
  };

  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue =
    dueDate && dueDate < new Date() && task.status !== "completed";

  return (
    <Card
      className={cn(
        "group transition-all duration-200 hover:shadow-md",
        task.status === "in_progress" && "border-primary/30 bg-primary/[0.02]"
      )}
    >
      <CardContent className={cn("p-4", compact && "p-3")}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-1.5">
            {/* Client/Project indicator */}
            {client && project && (
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: client.color }}
                />
                <span className="text-xs text-muted-foreground">
                  {client.name} · {project.name}
                </span>
              </div>
            )}

            {/* Title */}
            <h4
              className={cn(
                "font-medium leading-tight",
                compact ? "text-sm" : "text-base",
                task.status === "completed" &&
                  "text-muted-foreground line-through"
              )}
            >
              {task.title}
            </h4>

            {/* Meta info */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {task.estimatedTime && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Est. {formatDuration(task.estimatedTime)}
                </span>
              )}
              {dueDate && (
                <span
                  className={cn(
                    "flex items-center gap-1",
                    isOverdue && "text-destructive"
                  )}
                >
                  <Calendar className="h-3 w-3" />
                  {dueDate.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              )}
            </div>
          </div>

          {/* Right side: priority badge + actions */}
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-1">
              <Badge variant="secondary" className={cn("text-xs", priority.className)}>
                {priority.label}
              </Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Task actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit?.(task)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit task
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleDelete}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete task
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Quick start button */}
            {task.status !== "completed" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs opacity-0 transition-opacity group-hover:opacity-100"
                onClick={handleStartTimer}
              >
                <Play className="h-3 w-3 fill-current" />
                Start
              </Button>
            )}
          </div>
        </div>

        {/* Tags */}
        {task.tags.length > 0 && !compact && (
          <div className="mt-3 flex flex-wrap gap-1">
            {task.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
