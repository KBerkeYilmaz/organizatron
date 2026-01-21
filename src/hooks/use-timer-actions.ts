"use client";

import { useCallback, useRef } from "react";
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
  confirmActionAtom,
  rollbackTimerAtom,
  type TimerState,
  type TimerTask,
} from "~/store/timer-atoms";
import { formatTimer } from "~/lib/format";

/**
 * Lightweight hook for timer actions WITHOUT creating intervals.
 * Use this when you need to control the timer but don't need to display
 * the ticking time (e.g., start/pause/resume buttons in lists).
 *
 * Includes proper toast notifications and query invalidation.
 *
 * For components that need to display the timer value, use useTimer() instead.
 */
export function useTimerActions() {
  const utils = api.useUtils();

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
  const confirmAction = useSetAtom(confirmActionAtom);
  const rollbackTimer = useSetAtom(rollbackTimerAtom);

  // Keep track of previous state for rollbacks
  const previousStateRef = useRef<TimerState | null>(null);

  // Track if we're in a switch operation (to suppress duplicate toasts)
  const isSwitchingRef = useRef(false);

  // Helper to calculate elapsed time for display
  const calculateElapsed = useCallback(() => {
    if (timerState.status === "idle") return 0;
    if (timerState.status === "paused") return timerState.elapsed;
    if (timerState.startTime) {
      return timerState.elapsed + Math.floor((Date.now() - timerState.startTime) / 1000);
    }
    return timerState.elapsed;
  }, [timerState]);

  // tRPC mutations with proper callbacks
  const startMutation = api.activeTimer.start.useMutation({
    onSuccess: (data) => {
      confirmAction();
      void utils.activeTimer.getCurrent.invalidate();
      if (!isSwitchingRef.current) {
        toast.success("Timer started", {
          description: `Tracking time for "${data.task.title}"`,
        });
      }
      isSwitchingRef.current = false;
    },
    onError: (error) => {
      isSwitchingRef.current = false;
      if (previousStateRef.current) {
        rollbackTimer(previousStateRef.current);
      }
      toast.error("Failed to start timer", {
        description: error.message,
      });
    },
  });

  const pauseMutation = api.activeTimer.pause.useMutation({
    onSuccess: () => {
      confirmAction();
      void utils.activeTimer.getCurrent.invalidate();
      toast.info("Timer paused", {
        description: `Paused at ${formatTimer(calculateElapsed())}`,
      });
    },
    onError: (error) => {
      if (previousStateRef.current) {
        rollbackTimer(previousStateRef.current);
      }
      toast.error("Failed to pause timer", {
        description: error.message,
      });
    },
  });

  const resumeMutation = api.activeTimer.resume.useMutation({
    onSuccess: () => {
      confirmAction();
      void utils.activeTimer.getCurrent.invalidate();
      toast.success("Timer resumed", {
        description: "Continue tracking time",
      });
    },
    onError: (error) => {
      if (previousStateRef.current) {
        rollbackTimer(previousStateRef.current);
      }
      toast.error("Failed to resume timer", {
        description: error.message,
      });
    },
  });

  const stopMutation = api.activeTimer.stop.useMutation({
    onSuccess: (data) => {
      if (!data) return; // Timer was already stopped
      void utils.activeTimer.getCurrent.invalidate();
      void utils.timeEntry.getRecent.invalidate();
      void utils.timeEntry.getRecentGroupedByTask.invalidate();
      void utils.timeEntry.getFiltered.invalidate();
      void utils.stats.invalidate();
      if (!isSwitchingRef.current) {
        toast.success("Time entry saved", {
          description: `${formatTimer(data.duration)} logged for "${data.task.title}"`,
        });
      }
    },
    onError: (error) => {
      if (previousStateRef.current) {
        rollbackTimer(previousStateRef.current);
      }
      toast.error("Failed to stop timer", {
        description: error.message,
      });
    },
  });

  const discardMutation = api.activeTimer.discard.useMutation({
    onSuccess: (data) => {
      if (!data) return; // Timer was already discarded
      void utils.activeTimer.getCurrent.invalidate();
      toast.warning("Timer discarded", {
        description: "Time was not saved",
      });
    },
    onError: (error) => {
      if (previousStateRef.current) {
        rollbackTimer(previousStateRef.current);
      }
      toast.error("Failed to discard timer", {
        description: error.message,
      });
    },
  });

  const start = useCallback(
    (task: TimerTask) => {
      previousStateRef.current = { ...timerState };
      startTimer(task);
      startMutation.mutate({ taskId: task.id });
    },
    [timerState, startTimer, startMutation]
  );

  const pause = useCallback(() => {
    if (timerState.status !== "running") return;
    previousStateRef.current = { ...timerState };
    pauseTimer();
    pauseMutation.mutate();
  }, [timerState, pauseTimer, pauseMutation]);

  const resume = useCallback(() => {
    if (timerState.status !== "paused") return;
    previousStateRef.current = { ...timerState };
    resumeTimer();
    resumeMutation.mutate();
  }, [timerState, resumeTimer, resumeMutation]);

  const stop = useCallback(() => {
    if (timerState.status === "idle") return;
    previousStateRef.current = { ...timerState };
    stopTimer();
    stopMutation.mutate();
  }, [timerState, stopTimer, stopMutation]);

  const discard = useCallback(() => {
    if (timerState.status === "idle") return;
    previousStateRef.current = { ...timerState };
    discardTimer();
    discardMutation.mutate();
  }, [timerState, discardTimer, discardMutation]);

  // Switch task: stop current + start new
  const switchTask = useCallback(
    (newTask: TimerTask) => {
      if (isActive) {
        previousStateRef.current = { ...timerState };
        stopTimer();
        stopMutation.mutate(undefined, {
          onSuccess: (data) => {
            if (data) {
              void utils.timeEntry.getRecent.invalidate();
              void utils.timeEntry.getRecentGroupedByTask.invalidate();
              void utils.timeEntry.getFiltered.invalidate();
              void utils.stats.invalidate();
              toast.success("Switched tasks", {
                description: `${formatTimer(data.duration)} saved, now tracking "${newTask.title}"`,
              });
            }
            isSwitchingRef.current = true;
            startTimer(newTask);
            startMutation.mutate({ taskId: newTask.id });
          },
          onError: (error) => {
            if (previousStateRef.current) {
              rollbackTimer(previousStateRef.current);
            }
            toast.error("Failed to switch tasks", {
              description: error.message,
            });
          },
        });
      } else {
        start(newTask);
      }
    },
    [isActive, timerState, stopTimer, stopMutation, startTimer, startMutation, start, utils, rollbackTimer]
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
