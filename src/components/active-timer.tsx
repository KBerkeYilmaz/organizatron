"use client";

import { DollarSign, Loader2, Pause, Play, Square, X } from "lucide-react";
import { useCallback, useRef } from "react";

import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { useTimer } from "~/hooks/use-timer";
import { formatTimer } from "~/lib/format";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import type { TimerTask } from "~/store/timer-atoms";

interface ActiveTimerProps {
  className?: string;
}

const DEBOUNCE_MS = 300;

export function ActiveTimer({ className }: ActiveTimerProps) {
  const {
    displayTime,
    isActive,
    isRunning,
    isPaused,
    isLoading,
    isMutating,
    task,
    start,
    pause,
    resume,
    stop,
    discard,
  } = useTimer();

  const lastActionRef = useRef<number>(0);

  const debounced = useCallback((action: () => void) => {
    const now = Date.now();
    if (now - lastActionRef.current < DEBOUNCE_MS) return;
    lastActionRef.current = now;
    action();
  }, []);

  const { data: tasks } = api.task.getAll.useQuery({ status: "in_progress" });

  const handleStartTask = (taskId: string) => {
    debounced(() => {
      const selectedTask = tasks?.find((t) => t.id === taskId);
      if (selectedTask) {
        const timerTask: TimerTask = {
          id: selectedTask.id,
          title: selectedTask.title,
          project: {
            id: selectedTask.project.id,
            name: selectedTask.project.name,
            client: {
              id: selectedTask.project.client.id,
              name: selectedTask.project.client.name,
              color: selectedTask.project.client.color,
            },
          },
          isBillable: selectedTask.isBillable,
          hourlyRate: selectedTask.hourlyRate,
          currency: selectedTask.currency,
        };
        start(timerTask);
      }
    });
  };

  const handlePause = () => debounced(pause);
  const handleResume = () => debounced(resume);
  const handleStop = () => debounced(stop);
  const handleDiscard = () => debounced(discard);

  const project = task?.project;
  const client = project?.client;

  if (isLoading) {
    return (
      <div
        className={cn(
          "flex h-16 items-center justify-center rounded-lg border bg-card",
          className
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          "flex h-16 items-center justify-between gap-4 rounded-lg border bg-card px-4",
          isActive && "border-primary",
          className
        )}
      >
        {/* Left: Time and task info */}
        <div className="flex min-w-0 flex-1 items-center gap-4">
          {/* Time display */}
          <span
            className={cn(
              "font-mono text-2xl font-medium tabular-nums",
              isActive
                ? isPaused
                  ? "text-amber-500"
                  : "text-foreground"
                : "text-muted-foreground"
            )}
          >
            {formatTimer(displayTime)}
          </span>

          {/* Divider */}
          <div className="h-8 w-px bg-border" />

          {/* Task info */}
          <div className="min-w-0 flex-1">
            {task ? (
              <div className="flex items-center gap-2">
                {client && (
                  <span
                    className="h-2 w-2 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: client.color }}
                  />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-medium">{task.title}</p>
                    {task.isBillable && (
                      <span
                        className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30"
                        title={task.hourlyRate
                          ? `${(task.hourlyRate / 100).toFixed(2)} ${task.currency}/hr`
                          : "Billable"}
                      >
                        <DollarSign className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {client?.name && project?.name
                      ? `${client.name} / ${project.name}`
                      : "No project"}
                  </p>
                </div>
                {isPaused && (
                  <span className="flex-shrink-0 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase text-amber-500">
                    Paused
                  </span>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {tasks?.length ? "Select a task to start" : "No tasks available"}
              </p>
            )}
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex flex-shrink-0 items-center gap-2">
          {!isActive ? (
            <>
              {tasks && tasks.length > 0 && (
                <Select onValueChange={handleStartTask}>
                  <SelectTrigger className="h-9 w-[180px]">
                    <SelectValue placeholder="Select task..." />
                  </SelectTrigger>
                  <SelectContent>
                    {tasks.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: t.project.client.color }}
                          />
                          <span className="truncate">{t.title}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    onClick={() => tasks?.[0] && handleStartTask(tasks[0].id)}
                    disabled={!tasks?.length}
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Start timer</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={isRunning ? handlePause : handleResume}
                    disabled={isMutating}
                  >
                    {isRunning ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isRunning ? "Pause (Space)" : "Resume (Space)"}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={handleStop}
                    disabled={isMutating}
                  >
                    <Square className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Stop & Save (S)</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleDiscard}
                    disabled={isMutating}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Discard (D)</TooltipContent>
              </Tooltip>
            </>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
