"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Calendar, DollarSign, Eye, GripVertical, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { TaskTimerButton } from "~/components/task-timer-button";
import { cn } from "~/lib/utils";
import type { Priority } from "~/lib/types";
import type { TimerTask } from "~/store/timer-atoms";
import { api } from "~/trpc/react";

export interface KanbanTask {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "completed" | "archived";
  priority: Priority;
  estimatedTime: number | null;
  dueDate: Date | null;
  scheduledStart: Date | null;
  tags: string[];
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
    };
  };
}

interface TaskKanbanCardProps {
  task: KanbanTask;
  isDragging?: boolean;
  onEdit?: (task: KanbanTask) => void;
}

const priorityConfig: Record<Priority, { label: string; className: string }> = {
  low: {
    label: "Low",
    className: "bg-muted text-muted-foreground",
  },
  medium: {
    label: "Med",
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

export function TaskKanbanCard({ task, isDragging, onEdit }: TaskKanbanCardProps) {
  const utils = api.useUtils();
  const priority = priorityConfig[task.priority];

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const deleteMutation = api.task.delete.useMutation({
    onSuccess: () => {
      void utils.task.getAll.invalidate();
      toast.success("Task deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete task", { description: error.message });
    },
  });

  // Create timer task object for the TaskTimerButton
  const timerTask: TimerTask = {
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
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete "${task.title}"?`)) {
      deleteMutation.mutate({ id: task.id });
    }
  };

  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = dueDate && dueDate < new Date() && task.status !== "completed";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group rounded-lg border bg-card p-3 shadow-sm transition-all",
        "hover:shadow-md hover:border-primary/20",
        (isDragging || isSortableDragging) && "opacity-50 shadow-lg rotate-2",
        task.status === "completed" && "opacity-60"
      )}
    >
      <div className="flex items-start gap-2">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab touch-none opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>

        <Link href={`/task/${task.id}`} className="flex-1 min-w-0 space-y-2 cursor-pointer">
          {/* Title */}
          <p
            className={cn(
              "text-sm font-medium leading-tight line-clamp-2",
              task.status === "completed" && "line-through text-muted-foreground"
            )}
          >
            {task.title}
          </p>

          {/* Meta row */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className={cn("text-xs px-1.5 py-0", priority.className)}>
              {priority.label}
            </Badge>

            {dueDate && (
              <span
                className={cn(
                  "flex items-center gap-1 text-xs text-muted-foreground",
                  isOverdue && "text-destructive"
                )}
              >
                <Calendar className="h-3 w-3" />
                {dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            )}

            {task.isBillable && (
              <span
                className={cn(
                  "flex items-center justify-center h-4 w-4 rounded-full",
                  task.billingStatus === "paid"
                    ? "bg-emerald-100 dark:bg-emerald-900/30"
                    : "bg-amber-100 dark:bg-amber-900/30"
                )}
              >
                <DollarSign
                  className={cn(
                    "h-2.5 w-2.5",
                    task.billingStatus === "paid"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400"
                  )}
                />
              </span>
            )}
          </div>
        </Link>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {task.status !== "completed" && (
            <TaskTimerButton
              task={timerTask}
              className="h-6 w-6"
              iconSize="sm"
            />
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/task/${task.id}`}>
                  <Eye className="mr-2 h-4 w-4" />
                  View details
                </Link>
              </DropdownMenuItem>
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
      </div>
    </div>
  );
}
