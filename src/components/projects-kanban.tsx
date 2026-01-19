"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useState } from "react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import type { TaskStatus } from "~/lib/types";
import { KanbanColumn, KANBAN_COLUMNS } from "./kanban-column";
import { TaskKanbanCard, type KanbanTask } from "./task-kanban-card";

interface ProjectsKanbanProps {
  projectId: string;
  onAddTask?: () => void;
  onEditTask?: (task: KanbanTask) => void;
}

export function ProjectsKanban({ projectId, onAddTask, onEditTask }: ProjectsKanbanProps) {
  const [activeTask, setActiveTask] = useState<KanbanTask | null>(null);
  const utils = api.useUtils();

  const { data: tasks = [], isLoading } = api.task.getAll.useQuery({ projectId });

  const updateTask = api.task.update.useMutation({
    onMutate: async ({ id, status }) => {
      // Cancel outgoing refetches
      await utils.task.getAll.cancel({ projectId });

      // Snapshot previous value
      const previousTasks = utils.task.getAll.getData({ projectId });

      // Optimistically update
      utils.task.getAll.setData({ projectId }, (old) =>
        old?.map((t) => (t.id === id ? { ...t, status: status! } : t))
      );

      return { previousTasks };
    },
    onError: (err, _vars, context) => {
      // Rollback on error
      if (context?.previousTasks) {
        utils.task.getAll.setData({ projectId }, context.previousTasks);
      }
      toast.error("Failed to update task", { description: err.message });
    },
    onSettled: () => {
      void utils.task.getAll.invalidate({ projectId });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const tasksByStatus = KANBAN_COLUMNS.reduce(
    (acc, col) => {
      acc[col.id] = tasks.filter((t) => t.status === col.id) as KanbanTask[];
      return acc;
    },
    {} as Record<TaskStatus, KanbanTask[]>
  );

  const handleDragStart = (event: DragStartEvent) => {
    const taskId = event.active.id as string;
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      setActiveTask(task as KanbanTask);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    // Determine new status - could be dropping on column or on another task
    let newStatus: TaskStatus;

    // Check if dropping on a column
    if (KANBAN_COLUMNS.some((col) => col.id === overId)) {
      newStatus = overId as TaskStatus;
    } else {
      // Dropping on a task - find which column that task is in
      const targetTask = tasks.find((t) => t.id === overId);
      if (!targetTask) return;
      newStatus = targetTask.status as TaskStatus;
    }

    const currentTask = tasks.find((t) => t.id === taskId);
    if (!currentTask || currentTask.status === newStatus) return;

    updateTask.mutate({ id: taskId, status: newStatus });
  };

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {KANBAN_COLUMNS.map((col) => (
          <div
            key={col.id}
            className="flex flex-col rounded-lg border bg-muted/30 min-w-[280px] w-[280px] h-[400px] animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 w-full overflow-x-auto pb-4">
        {KANBAN_COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            status={col.id}
            tasks={tasksByStatus[col.id]}
            onAddTask={col.id === "todo" ? onAddTask : undefined}
            onEditTask={onEditTask}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask && <TaskKanbanCard task={activeTask} isDragging />}
      </DragOverlay>
    </DndContext>
  );
}
