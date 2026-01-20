"use client";

import { useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import {
  timerStateAtom,
  startTimerAtom,
  pauseTimerAtom,
  resumeTimerAtom,
  stopTimerAtom,
  discardTimerAtom,
  type TimerTask,
} from "~/store/timer-atoms";

/**
 * Lightweight hook for timer actions WITHOUT creating intervals.
 * Use this when you need to control the timer but don't need to display
 * the ticking time (e.g., start/pause/resume buttons in lists).
 *
 * For components that need to display the timer value, use useTimer() instead.
 */
export function useTimerActions() {
  // Read state directly from atom (no interval needed)
  const timerState = useAtomValue(timerStateAtom);
  const isActive = timerState.status !== "idle";
  const isRunning = timerState.status === "running";
  const isPaused = timerState.status === "paused";

  // Action atoms
  const startTimer = useSetAtom(startTimerAtom);
  const pauseTimer = useSetAtom(pauseTimerAtom);
  const resumeTimer = useSetAtom(resumeTimerAtom);
  const stopTimer = useSetAtom(stopTimerAtom);
  const discardTimer = useSetAtom(discardTimerAtom);

  // tRPC mutations
  const startMutation = api.activeTimer.start.useMutation();
  const pauseMutation = api.activeTimer.pause.useMutation();
  const resumeMutation = api.activeTimer.resume.useMutation();
  const stopMutation = api.activeTimer.stop.useMutation();
  const discardMutation = api.activeTimer.discard.useMutation();

  const start = useCallback(
    (task: TimerTask) => {
      startTimer(task);
      startMutation.mutate(
        { taskId: task.id },
        {
          onError: () => {
            toast.error("Failed to start timer");
          },
        }
      );
    },
    [startTimer, startMutation]
  );

  const pause = useCallback(() => {
    if (timerState.status !== "running") return;
    pauseTimer();
    pauseMutation.mutate(undefined, {
      onError: () => {
        toast.error("Failed to pause timer");
      },
    });
  }, [timerState.status, pauseTimer, pauseMutation]);

  const resume = useCallback(() => {
    if (timerState.status !== "paused") return;
    resumeTimer();
    resumeMutation.mutate(undefined, {
      onError: () => {
        toast.error("Failed to resume timer");
      },
    });
  }, [timerState.status, resumeTimer, resumeMutation]);

  const stop = useCallback(() => {
    if (timerState.status === "idle") return;
    stopTimer();
    stopMutation.mutate(undefined, {
      onError: () => {
        toast.error("Failed to stop timer");
      },
    });
  }, [timerState.status, stopTimer, stopMutation]);

  const discard = useCallback(() => {
    if (timerState.status === "idle") return;
    discardTimer();
    discardMutation.mutate(undefined, {
      onError: () => {
        toast.error("Failed to discard timer");
      },
    });
  }, [timerState.status, discardTimer, discardMutation]);

  // Switch task: stop current + start new
  const switchTask = useCallback(
    (newTask: TimerTask) => {
      if (isActive) {
        stopTimer();
        stopMutation.mutate(undefined, {
          onSuccess: () => {
            startTimer(newTask);
            startMutation.mutate({ taskId: newTask.id });
          },
        });
      } else {
        start(newTask);
      }
    },
    [isActive, stopTimer, stopMutation, startTimer, startMutation, start]
  );

  return {
    // State (read-only)
    timerState,
    task: timerState.task,
    isActive,
    isRunning,
    isPaused,

    // Actions
    start,
    pause,
    resume,
    stop,
    discard,
    switchTask,

    // Mutation states
    isLoading: startMutation.isPending,
    isMutating:
      startMutation.isPending ||
      pauseMutation.isPending ||
      resumeMutation.isPending ||
      stopMutation.isPending ||
      discardMutation.isPending,
  };
}
