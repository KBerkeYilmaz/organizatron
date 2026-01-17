"use client";

import { Loader2, Pause, Play, Square } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { formatTimer } from "~/lib/format";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

interface ActiveTimerProps {
  className?: string;
}

export function ActiveTimer({ className }: ActiveTimerProps) {
  const [localElapsed, setLocalElapsed] = useState(0);
  const [isLocalRunning, setIsLocalRunning] = useState(false);

  const utils = api.useUtils();

  // Fetch current active timer
  const { data: activeTimer, isLoading: timerLoading } =
    api.activeTimer.getCurrent.useQuery();

  // Fetch tasks for starting new timer
  const { data: tasks } = api.task.getAll.useQuery({ status: "in_progress" });

  // Mutations
  const startMutation = api.activeTimer.start.useMutation({
    onSuccess: () => {
      void utils.activeTimer.getCurrent.invalidate();
    },
  });

  const pauseMutation = api.activeTimer.pause.useMutation({
    onSuccess: () => {
      void utils.activeTimer.getCurrent.invalidate();
    },
  });

  const resumeMutation = api.activeTimer.resume.useMutation({
    onSuccess: () => {
      void utils.activeTimer.getCurrent.invalidate();
    },
  });

  const stopMutation = api.activeTimer.stop.useMutation({
    onSuccess: () => {
      void utils.activeTimer.getCurrent.invalidate();
      void utils.timeEntry.getRecent.invalidate();
      void utils.stats.invalidate();
      setLocalElapsed(0);
      setIsLocalRunning(false);
    },
  });

  // Sync local state with server state
  useEffect(() => {
    if (activeTimer) {
      const serverElapsed = activeTimer.elapsed;
      const timeSinceStart = Math.floor(
        (Date.now() - new Date(activeTimer.startTime).getTime()) / 1000
      );
      setLocalElapsed(serverElapsed + timeSinceStart);
      setIsLocalRunning(true);
    } else {
      setLocalElapsed(0);
      setIsLocalRunning(false);
    }
  }, [activeTimer]);

  // Local timer tick
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isLocalRunning && activeTimer) {
      interval = setInterval(() => {
        const serverElapsed = activeTimer.elapsed;
        const timeSinceStart = Math.floor(
          (Date.now() - new Date(activeTimer.startTime).getTime()) / 1000
        );
        setLocalElapsed(serverElapsed + timeSinceStart);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLocalRunning, activeTimer]);

  const handleStart = useCallback(() => {
    const firstTask = tasks?.[0];
    if (firstTask) {
      startMutation.mutate({ taskId: firstTask.id });
    }
  }, [tasks, startMutation]);

  const handlePause = useCallback(() => {
    pauseMutation.mutate();
  }, [pauseMutation]);

  const handleResume = useCallback(() => {
    resumeMutation.mutate();
  }, [resumeMutation]);

  const handleStop = useCallback(() => {
    stopMutation.mutate();
  }, [stopMutation]);

  const task = activeTimer?.task;
  const project = task?.project;
  const client = project?.client;
  const hasActiveTimer = !!activeTimer;
  const isPending =
    startMutation.isPending ||
    pauseMutation.isPending ||
    resumeMutation.isPending ||
    stopMutation.isPending;

  if (timerLoading) {
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
        hasActiveTimer
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
                hasActiveTimer ? "text-primary" : "text-foreground"
              )}
            >
              {formatTimer(localElapsed)}
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
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">
                {tasks?.length
                  ? "Select a task to start tracking"
                  : "No in-progress tasks"}
              </span>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {!hasActiveTimer ? (
              <Button
                size="lg"
                onClick={handleStart}
                disabled={!tasks?.length || isPending}
                className="h-14 w-14 rounded-full shadow-lg transition-all hover:scale-105 hover:shadow-xl"
              >
                {isPending ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <Play className="h-6 w-6 fill-current" />
                )}
                <span className="sr-only">Start timer</span>
              </Button>
            ) : (
              <>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handlePause}
                  disabled={isPending}
                  className="h-12 w-12 rounded-full"
                >
                  {isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Pause className="h-5 w-5" />
                  )}
                  <span className="sr-only">Pause timer</span>
                </Button>
                <Button
                  size="lg"
                  variant="destructive"
                  onClick={handleStop}
                  disabled={isPending}
                  className="h-12 w-12 rounded-full"
                >
                  {isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Square className="h-5 w-5 fill-current" />
                  )}
                  <span className="sr-only">Stop timer</span>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Progress indicator when running */}
        {hasActiveTimer && (
          <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-1000"
              style={{ width: `${Math.min((localElapsed / 3600) * 100, 100)}%` }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
