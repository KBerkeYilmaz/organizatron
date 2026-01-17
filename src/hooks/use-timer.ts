"use client";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import {
  confirmActionAtom,
  displayTimeAtom,
  isTimerActiveAtom,
  isTimerPausedAtom,
  isTimerRunningAtom,
  pauseTimerAtom,
  resumeTimerAtom,
  rollbackTimerAtom,
  startTimerAtom,
  stopTimerAtom,
  discardTimerAtom,
  syncFromServerAtom,
  timerStateAtom,
  restoreDiscardedTimerAtom,
  type TimerState,
  type TimerTask,
} from "~/store/timer-atoms";
import { formatTimer } from "~/lib/format";

export function useTimer() {
  const utils = api.useUtils();

  // Jotai state
  const [timerState] = useAtom(timerStateAtom);
  const displayTime = useAtomValue(displayTimeAtom);
  const isActive = useAtomValue(isTimerActiveAtom);
  const isRunning = useAtomValue(isTimerRunningAtom);
  const isPaused = useAtomValue(isTimerPausedAtom);

  // Action setters
  const startTimer = useSetAtom(startTimerAtom);
  const pauseTimer = useSetAtom(pauseTimerAtom);
  const resumeTimer = useSetAtom(resumeTimerAtom);
  const stopTimer = useSetAtom(stopTimerAtom);
  const discardTimer = useSetAtom(discardTimerAtom);
  const confirmAction = useSetAtom(confirmActionAtom);
  const rollbackTimer = useSetAtom(rollbackTimerAtom);
  const syncFromServer = useSetAtom(syncFromServerAtom);
  const restoreDiscardedTimer = useSetAtom(restoreDiscardedTimerAtom);

  // Keep track of previous state for rollbacks
  const previousStateRef = useRef<TimerState | null>(null);

  // Track if we've done initial sync (prevent server data from overriding client state)
  const hasInitialSyncRef = useRef(false);

  // Local tick state for smooth display updates
  const [tickTime, setTickTime] = useState(0);

  // Tick effect for running timer
  useEffect(() => {
    if (!isRunning || !timerState.startTime) {
      setTickTime(displayTime);
      return;
    }

    // Initial sync
    setTickTime(displayTime);

    const interval = setInterval(() => {
      const timeSinceStart = Math.floor(
        (Date.now() - timerState.startTime!) / 1000
      );
      setTickTime(timerState.elapsed + timeSinceStart);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, timerState.startTime, timerState.elapsed, displayTime]);

  // Fetch current active timer from server (only on mount, no refetching)
  const { data: serverTimer, isLoading: isLoadingTimer } =
    api.activeTimer.getCurrent.useQuery(undefined, {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      staleTime: Infinity,
    });

  // Sync server data to Jotai ONLY on initial load
  useEffect(() => {
    if (isLoadingTimer || hasInitialSyncRef.current) return;

    hasInitialSyncRef.current = true;

    if (serverTimer) {
      syncFromServer({
        id: serverTimer.id,
        taskId: serverTimer.taskId,
        startTime: serverTimer.startTime,
        elapsed: serverTimer.elapsed,
        isPaused: serverTimer.isPaused,
        task: {
          id: serverTimer.task.id,
          title: serverTimer.task.title,
          project: {
            id: serverTimer.task.project.id,
            name: serverTimer.task.project.name,
            client: {
              id: serverTimer.task.project.client.id,
              name: serverTimer.task.project.client.name,
              color: serverTimer.task.project.client.color,
            },
          },
        },
      });
    }
    // No else - don't reset if no server timer, Jotai already starts with idle state
  }, [serverTimer, isLoadingTimer, syncFromServer]);

  // tRPC mutations - no invalidation needed, Jotai is source of truth
  const startMutation = api.activeTimer.start.useMutation({
    onSuccess: (data) => {
      confirmAction();
      toast.success("Timer started", {
        description: `Tracking time for "${data.task.title}"`,
      });
    },
    onError: (error) => {
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
      toast.info("Timer paused", {
        description: `Paused at ${formatTimer(tickTime)}`,
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
      // State already reset optimistically, just show toast and invalidate
      void utils.timeEntry.getRecent.invalidate();
      void utils.timeEntry.getRecentGroupedByTask.invalidate();
      void utils.stats.invalidate();
      toast.success("Time entry saved", {
        description: `${formatTimer(data.duration)} logged for "${data.task.title}"`,
      });
    },
    onError: (error) => {
      // Restore previous state on error
      if (previousStateRef.current) {
        rollbackTimer(previousStateRef.current);
      }
      toast.error("Failed to stop timer", {
        description: error.message,
      });
    },
  });

  const discardMutation = api.activeTimer.discard.useMutation({
    onSuccess: () => {
      // State already reset optimistically, show toast with undo option
      toast.warning("Timer discarded", {
        description: "Time was not saved",
        duration: 10000, // Match UNDO_TIMEOUT_MS
        action: {
          label: "Undo",
          onClick: () => {
            const restored = restoreDiscardedTimer();
            if (restored) {
              // Re-create the timer on the server
              if (previousStateRef.current?.task) {
                startMutation.mutate({ taskId: previousStateRef.current.task.id });
              }
              toast.success("Timer restored", {
                description: "Your timer has been restored",
              });
            }
          },
        },
      });
    },
    onError: (error) => {
      // Restore previous state on error
      if (previousStateRef.current) {
        rollbackTimer(previousStateRef.current);
      }
      toast.error("Failed to discard timer", {
        description: error.message,
      });
    },
  });

  // Action handlers with optimistic updates
  const handleStart = useCallback(
    (task: TimerTask) => {
      previousStateRef.current = { ...timerState };
      startTimer(task);
      startMutation.mutate({ taskId: task.id });
    },
    [timerState, startTimer, startMutation]
  );

  const handlePause = useCallback(() => {
    previousStateRef.current = { ...timerState };
    pauseTimer();
    pauseMutation.mutate();
  }, [timerState, pauseTimer, pauseMutation]);

  const handleResume = useCallback(() => {
    previousStateRef.current = { ...timerState };
    resumeTimer();
    resumeMutation.mutate();
  }, [timerState, resumeTimer, resumeMutation]);

  const handleStop = useCallback(() => {
    previousStateRef.current = { ...timerState };
    stopTimer();
    stopMutation.mutate();
  }, [timerState, stopTimer, stopMutation]);

  const handleDiscard = useCallback(() => {
    previousStateRef.current = { ...timerState };
    discardTimer();
    discardMutation.mutate();
  }, [timerState, discardTimer, discardMutation]);

  // Switch to a different task (stops current, starts new)
  const handleSwitchTask = useCallback(
    (newTask: TimerTask) => {
      if (!isActive) {
        // No active timer, just start
        handleStart(newTask);
        return;
      }

      // Store current state for potential rollback
      previousStateRef.current = { ...timerState };

      // Stop current timer and save it
      stopTimer();
      stopMutation.mutate(undefined, {
        onSuccess: (data) => {
          void utils.timeEntry.getRecent.invalidate();
          void utils.timeEntry.getRecentGroupedByTask.invalidate();
          void utils.stats.invalidate();
          toast.success("Switched tasks", {
            description: `${formatTimer(data.duration)} saved, now tracking "${newTask.title}"`,
          });
        },
        onError: (error) => {
          // Restore previous state on error
          if (previousStateRef.current) {
            rollbackTimer(previousStateRef.current);
          }
          toast.error("Failed to switch tasks", {
            description: error.message,
          });
          return; // Don't start new timer if stop failed
        },
        onSettled: () => {
          // Start the new timer regardless of stop result display
          startTimer(newTask);
          startMutation.mutate({ taskId: newTask.id });
        },
      });
    },
    [
      isActive,
      timerState,
      stopTimer,
      stopMutation,
      startTimer,
      startMutation,
      handleStart,
      utils,
      rollbackTimer,
    ]
  );

  return {
    // State
    timerState,
    displayTime: tickTime,
    isActive,
    isRunning,
    isPaused,
    isLoading: isLoadingTimer,
    isPending: timerState.isPending,
    pendingAction: timerState.pendingAction,
    task: timerState.task,

    // Actions
    start: handleStart,
    pause: handlePause,
    resume: handleResume,
    stop: handleStop,
    discard: handleDiscard,
    switchTask: handleSwitchTask,
  };
}
