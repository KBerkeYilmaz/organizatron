"use client";

import { format } from "date-fns";
import {
  ArrowUpDown,
  DollarSign,
  MoreHorizontal,
  Pencil,
  Play,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Skeleton } from "~/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import type { TimerTask } from "~/store/timer-atoms";
import { useTimer } from "~/hooks/use-timer";

type TaskStatus = "todo" | "in_progress" | "completed" | "archived";
type TaskPriority = "low" | "medium" | "high" | "urgent";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  projectId: string;
  estimatedTime: number | null;
  dueDate: Date | null;
  tags: string[];
  createdAt: Date;
  // Billing
  isBillable: boolean;
  hourlyRate: number | null;
  currency: string;
  project: {
    id: string;
    name: string;
    client: {
      id: string;
      name: string;
      color: string;
    };
  };
  _count?: {
    timeEntries: number;
  };
}

interface TaskTableProps {
  tasks: Task[];
  isLoading?: boolean;
  onEdit: (task: Task) => void;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

const PRIORITY_CONFIG: Record<
  TaskPriority,
  { label: string; className: string }
> = {
  low: { label: "Low", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  medium: { label: "Medium", className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  high: { label: "High", className: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" },
  urgent: { label: "Urgent", className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
};

const STATUS_CONFIG: Record<TaskStatus, { label: string; className: string }> = {
  todo: { label: "To Do", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  in_progress: { label: "In Progress", className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  completed: { label: "Completed", className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  archived: { label: "Archived", className: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" },
};

type SortField = "title" | "status" | "priority" | "dueDate" | "createdAt";
type SortOrder = "asc" | "desc";

export function TaskTable({
  tasks,
  isLoading,
  onEdit,
  selectedIds,
  onSelectionChange,
}: TaskTableProps) {
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const utils = api.useUtils();
  const { start } = useTimer();

  const deleteMutation = api.task.delete.useMutation({
    onSuccess: () => {
      void utils.task.getAll.invalidate();
      toast.success("Task deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete task", { description: error.message });
    },
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    const multiplier = sortOrder === "asc" ? 1 : -1;

    switch (sortField) {
      case "title":
        return multiplier * a.title.localeCompare(b.title);
      case "status": {
        const statusOrder = ["todo", "in_progress", "completed", "archived"];
        return multiplier * (statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status));
      }
      case "priority": {
        const priorityOrder = ["urgent", "high", "medium", "low"];
        return multiplier * (priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority));
      }
      case "dueDate": {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return multiplier * (new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      }
      case "createdAt":
        return multiplier * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      default:
        return 0;
    }
  });

  const toggleSelectAll = () => {
    if (selectedIds.length === tasks.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(tasks.map((t) => t.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((i) => i !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const handleStartTimer = (task: Task) => {
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
    start(timerTask);
  };

  const handleDelete = (task: Task) => {
    if (confirm(`Delete "${task.title}"?`)) {
      deleteMutation.mutate({ id: task.id });
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const SortableHeader = ({
    field,
    children,
  }: {
    field: SortField;
    children: React.ReactNode;
  }) => (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 data-[state=open]:bg-accent"
      onClick={() => handleSort(field)}
    >
      {children}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );

  if (isLoading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Skeleton className="h-4 w-4" />
              </TableHead>
              <TableHead><Skeleton className="h-4 w-16" /></TableHead>
              <TableHead><Skeleton className="h-4 w-24" /></TableHead>
              <TableHead><Skeleton className="h-4 w-16" /></TableHead>
              <TableHead><Skeleton className="h-4 w-16" /></TableHead>
              <TableHead><Skeleton className="h-4 w-20" /></TableHead>
              <TableHead><Skeleton className="h-4 w-16" /></TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                <TableCell>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                <TableCell><Skeleton className="h-8 w-8 rounded" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-lg font-medium text-muted-foreground">No tasks found</p>
        <p className="text-sm text-muted-foreground">
          Try adjusting your filters or create a new task.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={selectedIds.length === tasks.length && tasks.length > 0}
                onCheckedChange={toggleSelectAll}
                aria-label="Select all"
              />
            </TableHead>
            <TableHead>
              <SortableHeader field="title">Task</SortableHeader>
            </TableHead>
            <TableHead>Client / Project</TableHead>
            <TableHead>
              <SortableHeader field="status">Status</SortableHeader>
            </TableHead>
            <TableHead>
              <SortableHeader field="priority">Priority</SortableHeader>
            </TableHead>
            <TableHead>
              <SortableHeader field="dueDate">Due Date</SortableHeader>
            </TableHead>
            <TableHead>Est. Time</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedTasks.map((task) => {
            const isOverdue =
              task.dueDate &&
              new Date(task.dueDate) < new Date() &&
              task.status !== "completed";

            return (
              <TableRow
                key={task.id}
                className={cn(
                  selectedIds.includes(task.id) && "bg-muted/50",
                  task.status === "completed" && "opacity-60"
                )}
              >
                <TableCell>
                  <Checkbox
                    checked={selectedIds.includes(task.id)}
                    onCheckedChange={() => toggleSelect(task.id)}
                    aria-label={`Select ${task.title}`}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "font-medium",
                          task.status === "completed" && "line-through"
                        )}
                      >
                        {task.title}
                      </span>
                      {task.isBillable && (
                        <span
                          className="flex items-center justify-center h-4 w-4 rounded-full bg-emerald-100 dark:bg-emerald-900/30"
                          title={task.hourlyRate
                            ? `${(task.hourlyRate / 100).toFixed(2)} ${task.currency}/hr`
                            : "Billable"}
                        >
                          <DollarSign className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                        </span>
                      )}
                    </div>
                    {task.tags.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {task.tags.slice(0, 3).map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="text-xs px-1 py-0"
                          >
                            {tag}
                          </Badge>
                        ))}
                        {task.tags.length > 3 && (
                          <span className="text-xs text-muted-foreground">
                            +{task.tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: task.project.client.color }}
                    />
                    <span className="text-sm">
                      {task.project.client.name} / {task.project.name}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={STATUS_CONFIG[task.status].className}
                  >
                    {STATUS_CONFIG[task.status].label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={PRIORITY_CONFIG[task.priority].className}
                  >
                    {PRIORITY_CONFIG[task.priority].label}
                  </Badge>
                </TableCell>
                <TableCell>
                  {task.dueDate ? (
                    <span
                      className={cn(
                        "text-sm",
                        isOverdue && "text-red-600 font-medium"
                      )}
                    >
                      {format(new Date(task.dueDate), "MMM d, yyyy")}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {task.estimatedTime ? (
                    <span className="text-sm">
                      {formatDuration(task.estimatedTime)}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {task.status !== "completed" && (
                        <DropdownMenuItem onClick={() => handleStartTimer(task)}>
                          <Play className="mr-2 h-4 w-4" />
                          Start Timer
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => onEdit(task)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDelete(task)}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
