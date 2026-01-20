"use client";

import { useCallback, useState } from "react";
import type { SlotInfo } from "react-big-calendar";

import {
  OrganizatronCalendar,
  tasksToCalendarEvents,
  type CalendarEvent,
} from "~/components/big-calendar";
import { PageHeader } from "~/components/page-header";
import { TaskDialog } from "~/components/task-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";
import { format } from "date-fns";
import {
  Calendar as CalendarIcon,
  Clock,
  DollarSign,
  ExternalLink,
  Flag,
  FolderOpen,
  Play,
} from "lucide-react";
import { useTimer } from "~/hooks/use-timer";
import type { TimerTask } from "~/store/timer-atoms";

const priorityColors: Record<string, string> = {
  low: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  medium: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  high: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  urgent: "bg-red-500/10 text-red-600 dark:text-red-400",
};

const statusLabels: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  completed: "Completed",
  archived: "Archived",
};

export default function CalendarPage() {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [newTaskDate, setNewTaskDate] = useState<Date | null>(null);

  const { start, isActive } = useTimer();

  // Fetch all tasks with due dates
  const { data: tasks, isLoading } = api.task.getAll.useQuery();

  // Convert tasks to calendar events
  const events = tasks ? tasksToCalendarEvents(tasks) : [];

  // Handle clicking on an event
  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
    setDetailsOpen(true);
  }, []);

  // Handle clicking on an empty slot (to create new task)
  const handleSelectSlot = useCallback((slotInfo: SlotInfo) => {
    setNewTaskDate(slotInfo.start);
    setTaskDialogOpen(true);
  }, []);

  // Handle starting timer for task
  const handleStartTimer = useCallback(() => {
    if (!selectedEvent?.resource || isActive) return;

    const task = tasks?.find((t) => t.id === selectedEvent.resource?.taskId);
    if (!task) return;

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
    setDetailsOpen(false);
  }, [selectedEvent, tasks, start, isActive]);

  const taskCount = events.length;

  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle={`${taskCount} scheduled task${taskCount !== 1 ? "s" : ""}`}
      />

      {/* Calendar */}
      <main className="flex-1 overflow-hidden p-6">
        {isLoading ? (
          <div className="flex h-full flex-col gap-4 rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-9 w-64" />
            </div>
            <div className="flex-1">
              <Skeleton className="h-full w-full" />
            </div>
          </div>
        ) : (
          <OrganizatronCalendar
            events={events}
            onSelectEvent={handleSelectEvent}
            onSelectSlot={handleSelectSlot}
            defaultView="week"
            className="h-full"
          />
        )}
      </main>

      {/* Event Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedEvent?.resource?.clientColor && (
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: selectedEvent.resource.clientColor }}
                />
              )}
              {selectedEvent?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedEvent?.resource?.clientName} /{" "}
              {selectedEvent?.resource?.projectName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Time */}
            <div className="flex items-center gap-3 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>
                {selectedEvent?.start &&
                  format(selectedEvent.start, "EEEE, MMMM d, yyyy")}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <span>
                {selectedEvent?.start && format(selectedEvent.start, "h:mm a")} -{" "}
                {selectedEvent?.end && format(selectedEvent.end, "h:mm a")}
              </span>
            </div>

            {/* Project */}
            <div className="flex items-center gap-3 text-sm">
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              <span>{selectedEvent?.resource?.projectName}</span>
            </div>

            {/* Status & Priority */}
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {selectedEvent?.resource?.status &&
                  statusLabels[selectedEvent.resource.status]}
              </Badge>
              {selectedEvent?.resource?.priority && (
                <Badge
                  className={priorityColors[selectedEvent.resource.priority]}
                >
                  <Flag className="mr-1 h-3 w-3" />
                  {selectedEvent.resource.priority}
                </Badge>
              )}
              {selectedEvent?.resource?.isBillable && (
                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <DollarSign className="mr-1 h-3 w-3" />
                  Billable
                </Badge>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setDetailsOpen(false);
                // Could navigate to task page or open edit dialog
              }}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              View Task
            </Button>
            <Button
              className="flex-1"
              onClick={handleStartTimer}
              disabled={
                isActive ||
                selectedEvent?.resource?.status === "completed" ||
                selectedEvent?.resource?.status === "archived"
              }
            >
              <Play className="mr-2 h-4 w-4" />
              Start Timer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Task Dialog */}
      <TaskDialog
        open={taskDialogOpen}
        onOpenChange={(open) => {
          setTaskDialogOpen(open);
          if (!open) setNewTaskDate(null);
        }}
        task={null}
        defaultDueDate={newTaskDate ?? undefined}
      />
    </>
  );
}
