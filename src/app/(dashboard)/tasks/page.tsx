"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "~/components/page-header";
import { TaskDialog } from "~/components/task-dialog";
import { TaskFilters, type TaskFiltersState } from "~/components/task-filters";
import { TaskTable } from "~/components/task-table";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { api } from "~/trpc/react";

type TaskStatus = "todo" | "in_progress" | "completed" | "archived";

export default function TasksPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Parameters<typeof TaskDialog>[0]["task"]>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filters, setFilters] = useState<TaskFiltersState>({
    search: "",
    status: "all",
    priority: "all",
    clientId: "",
    projectId: "",
  });

  const utils = api.useUtils();

  // Build query params from filters
  const queryParams = {
    ...(filters.search && { search: filters.search }),
    ...(filters.status !== "all" && { status: filters.status as TaskStatus }),
    ...(filters.priority !== "all" && { priority: filters.priority }),
    ...(filters.clientId && { clientId: filters.clientId }),
    ...(filters.projectId && { projectId: filters.projectId }),
  };

  const { data: tasks, isLoading } = api.task.getAll.useQuery(
    Object.keys(queryParams).length > 0 ? queryParams : undefined
  );

  const updateStatusMutation = api.task.updateStatus.useMutation({
    onSuccess: () => {
      void utils.task.getAll.invalidate();
      setSelectedIds([]);
      toast.success("Tasks updated");
    },
    onError: (error) => {
      toast.error("Failed to update tasks", { description: error.message });
    },
  });

  const deleteManyMutation = api.task.deleteMany.useMutation({
    onSuccess: () => {
      void utils.task.getAll.invalidate();
      setSelectedIds([]);
      toast.success("Tasks deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete tasks", { description: error.message });
    },
  });

  const handleEdit = (task: NonNullable<typeof editingTask>) => {
    setEditingTask(task);
    setDialogOpen(true);
  };

  const handleBulkStatusChange = (status: TaskStatus) => {
    if (selectedIds.length === 0) return;
    updateStatusMutation.mutate({ ids: selectedIds, status });
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    if (confirm(`Delete ${selectedIds.length} task(s)?`)) {
      deleteManyMutation.mutate({ ids: selectedIds });
    }
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingTask(null);
    }
  };

  const taskCount = tasks?.length ?? 0;

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle={`${taskCount} task${taskCount !== 1 ? "s" : ""}`}
      />

      {/* Filters & Bulk Actions */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b px-6 py-4">
        <TaskFilters filters={filters} onFiltersChange={setFilters} />

        <div className="flex items-center gap-2">
          {/* Bulk actions - show when items selected */}
          {selectedIds.length > 0 && (
            <>
              <span className="text-sm text-muted-foreground">
                {selectedIds.length} selected
              </span>
              <Select onValueChange={(v) => handleBulkStatusChange(v as TaskStatus)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Set status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={deleteManyMutation.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </>
          )}

          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Task
          </Button>
        </div>
      </div>

      {/* Table */}
      <main className="flex-1 overflow-y-auto p-6">
        <TaskTable
          tasks={tasks ?? []}
          isLoading={isLoading}
          onEdit={handleEdit}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      </main>

      {/* Dialog */}
      <TaskDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        task={editingTask}
      />
    </>
  );
}
