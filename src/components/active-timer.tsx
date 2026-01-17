"use client";

import { Pause, Play, Square } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { formatTimer } from "~/lib/format";
import { cn } from "~/lib/utils";
import type { Task } from "~/lib/types";
import { getClientForProject, getProject, tasks } from "~/lib/data/mock";

interface ActiveTimerProps {
  className?: string;
}

export function ActiveTimer({ className }: ActiveTimerProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Get first in-progress task as default
  useEffect(() => {
    const inProgressTask = tasks.find((t) => t.status === "in_progress");
    if (inProgressTask && !selectedTask) {
      setSelectedTask(inProgressTask);
    }
  }, [selectedTask]);

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isRunning && !isPaused) {
      interval = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, isPaused]);

  const handleStart = useCallback(() => {
    setIsRunning(true);
    setIsPaused(false);
  }, []);

  const handlePause = useCallback(() => {
    setIsPaused(true);
  }, []);

  const handleResume = useCallback(() => {
    setIsPaused(false);
  }, []);

  const handleStop = useCallback(() => {
    setIsRunning(false);
    setIsPaused(false);
    setElapsed(0);
  }, []);

  const project = selectedTask ? getProject(selectedTask.projectId) : null;
  const client = selectedTask ? getClientForProject(selectedTask.projectId) : null;

  return (
    <Card
      className={cn(
        "overflow-hidden border-2 transition-all duration-300",
        isRunning && !isPaused
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
                isRunning && !isPaused
                  ? "text-primary"
                  : "text-foreground"
              )}
            >
              {formatTimer(elapsed)}
            </div>
            {selectedTask ? (
              <div className="flex items-center gap-2">
                {client && (
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: client.color }}
                  />
                )}
                <span className="text-sm text-muted-foreground">
                  {client?.name && project?.name
                    ? `${client.name} · ${project.name} · ${selectedTask.title}`
                    : selectedTask.title}
                </span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">
                No task selected
              </span>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {!isRunning ? (
              <Button
                size="lg"
                onClick={handleStart}
                disabled={!selectedTask}
                className="h-14 w-14 rounded-full shadow-lg transition-all hover:scale-105 hover:shadow-xl"
              >
                <Play className="h-6 w-6 fill-current" />
                <span className="sr-only">Start timer</span>
              </Button>
            ) : (
              <>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={isPaused ? handleResume : handlePause}
                  className="h-12 w-12 rounded-full"
                >
                  {isPaused ? (
                    <Play className="h-5 w-5 fill-current" />
                  ) : (
                    <Pause className="h-5 w-5" />
                  )}
                  <span className="sr-only">
                    {isPaused ? "Resume" : "Pause"} timer
                  </span>
                </Button>
                <Button
                  size="lg"
                  variant="destructive"
                  onClick={handleStop}
                  className="h-12 w-12 rounded-full"
                >
                  <Square className="h-5 w-5 fill-current" />
                  <span className="sr-only">Stop timer</span>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Progress indicator when running */}
        {isRunning && (
          <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full bg-primary transition-all duration-1000",
                isPaused ? "animate-pulse" : "animate-none"
              )}
              style={{ width: `${Math.min((elapsed / 3600) * 100, 100)}%` }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
