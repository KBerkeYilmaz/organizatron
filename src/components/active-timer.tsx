"use client";

import { Loader2, Pause, Play, Square, Trash2 } from "lucide-react";
import { useCallback, useRef } from "react";

import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
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
    task,
    start,
    pause,
    resume,
    stop,
    discard,
  } = useTimer();

  // Debounce ref to prevent rapid clicking
  const lastActionRef = useRef<number>(0);

  const debounced = useCallback((action: () => void) => {
    const now = Date.now();
    if (now - lastActionRef.current < DEBOUNCE_MS) return;
    lastActionRef.current = now;
    action();
  }, []);

  // Fetch tasks for starting new timer
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
      <Card className={cn("overflow-hidden", className)}>
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "overflow-hidden border-2 transition-all duration-300",
        isActive
          ? "border-primary/50 shadow-lg shadow-primary/10"
          : "border-transparent",
        className
      )}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between gap-6">
          {/* Timer Display */}
          <div className="flex flex-col gap-1">
            <div
              className={cn(
                "font-mono text-5xl font-light tracking-tight tabular-nums transition-colors",
                isActive ? "text-primary" : "text-foreground",
                isPaused && "animate-pulse"
              )}
            >
              {formatTimer(displayTime)}
            </div>
            {task ? (
              <div className="flex items-center gap-2">
                {client && (
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: client.color }}
                  />
                )}
                <span className="text-sm text-muted-foreground">
                  {client?.name && project?.name
                    ? `${client.name} · ${project.name} · ${task.title}`
                    : task.title}
                </span>
                {isPaused && (
                  <span className="rounded bg-yellow-500/10 px-1.5 py-0.5 text-xs font-medium text-yellow-600 dark:text-yellow-400">
                    Paused
                  </span>
                )}
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">
                {tasks?.length
                  ? "Select a task to start tracking"
                  : "No in-progress tasks available"}
              </span>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {!isActive ? (
              // Idle state - show task selector and start button
              <div className="flex items-center gap-2">
                {tasks && tasks.length > 0 && (
                  <Select onValueChange={handleStartTask}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Select a task..." />
                    </SelectTrigger>
                    <SelectContent>
                      {tasks.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{
                                backgroundColor: t.project.client.color,
                              }}
                            />
                            <span className="truncate">{t.title}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button
                  size="lg"
                  onClick={() => tasks?.[0] && handleStartTask(tasks[0].id)}
                  disabled={!tasks?.length}
                  className="h-14 w-14 rounded-full shadow-lg transition-all hover:scale-105 hover:shadow-xl"
                >
                  <Play className="h-6 w-6 fill-current" />
                  <span className="sr-only">Start timer</span>
                </Button>
              </div>
            ) : (
              // Active state - show pause/resume, stop, discard
              <>
                {isRunning ? (
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={handlePause}
                    className="h-12 w-12 rounded-full"
                  >
                    <Pause className="h-5 w-5" />
                    <span className="sr-only">Pause timer</span>
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={handleResume}
                    className="h-12 w-12 rounded-full border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                  >
                    <Play className="h-5 w-5 fill-current" />
                    <span className="sr-only">Resume timer</span>
                  </Button>
                )}
                <Button
                  size="lg"
                  variant="destructive"
                  onClick={handleStop}
                  className="h-12 w-12 rounded-full"
                >
                  <Square className="h-5 w-5 fill-current" />
                  <span className="sr-only">Stop and save timer</span>
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  onClick={handleDiscard}
                  className="h-12 w-12 rounded-full text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-5 w-5" />
                  <span className="sr-only">Discard timer</span>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Progress indicator when active */}
        {isActive && (
          <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full transition-all duration-1000",
                isPaused ? "bg-yellow-500" : "bg-primary"
              )}
              style={{ width: `${Math.min((displayTime / 3600) * 100, 100)}%` }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
