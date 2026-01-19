"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";

import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import { cn } from "~/lib/utils";
import type { TaskStatus } from "~/lib/types";
import { TaskKanbanCard, type KanbanTask } from "./task-kanban-card";

interface ColumnConfig {
  id: TaskStatus;
  label: string;
  color: string;
  bgColor: string;
}

export const KANBAN_COLUMNS: ColumnConfig[] = [
  { id: "todo", label: "To Do", color: "bg-slate-500", bgColor: "bg-slate-500/5" },
  { id: "in_progress", label: "In Progress", color: "bg-blue-500", bgColor: "bg-blue-500/5" },
  { id: "completed", label: "Completed", color: "bg-emerald-500", bgColor: "bg-emerald-500/5" },
  { id: "archived", label: "Archived", color: "bg-zinc-400", bgColor: "bg-zinc-400/5" },
];

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: KanbanTask[];
  onAddTask?: () => void;
  onEditTask?: (task: KanbanTask) => void;
}

export function KanbanColumn({ status, tasks, onAddTask, onEditTask }: KanbanColumnProps) {
  const config = KANBAN_COLUMNS.find((c) => c.id === status)!;

  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  const taskIds = tasks.map((t) => t.id);

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border bg-muted/30 min-w-[200px] flex-1",
        isOver && "ring-2 ring-primary/50"
      )}
    >
      {/* Column header */}
      <div className={cn("flex items-center justify-between p-3 border-b", config.bgColor)}>
        <div className="flex items-center gap-2">
          <span className={cn("h-2.5 w-2.5 rounded-full", config.color)} />
          <h3 className="font-semibold text-sm">{config.label}</h3>
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
        {onAddTask && status === "todo" && (
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onAddTask}>
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Task list */}
      <ScrollArea className="flex-1">
        <div
          ref={setNodeRef}
          className={cn(
            "p-2 space-y-2 min-h-[200px]",
            isOver && "bg-primary/5"
          )}
        >
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            {tasks.map((task) => (
              <TaskKanbanCard key={task.id} task={task} onEdit={onEditTask} />
            ))}
          </SortableContext>

          {tasks.length === 0 && (
            <div className="flex items-center justify-center h-[100px] text-muted-foreground text-sm">
              No tasks
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
