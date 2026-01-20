"use client";

import { useAtom, useSetAtom } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import {
  confirmActionAtom,
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
import { hasPendingActions } from "~/lib/offline-queue";
import { hasPersistedTimerState } from "~/lib/timer-storage";

export function useTimer() {
  const utils = api.useUtils();

  // Jotai state - only subscribe to timerStateAtom, derive everything else
  const [timerState] = useAtom(timerStateAtom);

  // Derive status booleans from timerState (no extra subscriptions)
  const isActive = timerState.status !== "idle";
  const isRunning = timerState.status === "running";
  const isPaused = timerState.status === "paused";

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

  // Track if we're in a switch operation (to suppress duplicate toasts)
  const isSwitchingRef = useRef(false);

  // Track if we've done initial sync (prevent server data from overriding client state)
  const hasInitialSyncRef = useRef(false);

  // Local tick state for smooth display updates
  const [tickTime, setTickTime] = useState(0);

  // Helper to calculate current time
  const calculateCurrentTime = useCallback(() => {
    if (!isRunning || !timerState.startTime) {
      return timerState.elapsed;
    }
    const timeSinceStart = Math.floor(
      (Date.now() - timerState.startTime) / 1000
    );
    return timerState.elapsed + timeSinceStart;
  }, [isRunning, timerState.startTime, timerState.elapsed]);

  // Tick effect for running timer
  useEffect(() => {
    if (!isRunning || !timerState.startTime) {
      setTickTime(timerState.elapsed);
      return;
    }

    // Initial sync
    setTickTime(calculateCurrentTime());

    const interval = setInterval(() => {
      setTickTime(calculateCurrentTime());
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, timerState.startTime, timerState.elapsed, calculateCurrentTime]);

  // Immediately update timer when tab becomes visible (no 1-second delay)
  useEffect(() => {
    if (!isRunning || !timerState.startTime) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Immediately recalculate and update the display time
        setTickTime(calculateCurrentTime());
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isRunning, timerState.startTime, calculateCurrentTime]);

  // Fetch current active timer from server (only on mount, no refetching)
  const { data: serverTimer, isLoading: isLoadingTimer } =
    api.activeTimer.getCurrent.useQuery(undefined, {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      staleTime: Infinity,
    });

  // Sync server data to Jotai on initial load
  // Server is the source of truth for persisted timer state
  useEffect(() => {
    if (isLoadingTimer || hasInitialSyncRef.current) return;

    if (serverTimer) {
      // Server has an active timer - sync it to Jotai immediately
      hasInitialSyncRef.current = true;
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
    } else {
      // Server has NO timer - wait briefly for BroadcastChannel sync and localStorage restore
      // then check if we have stale state that needs to be reset
      const timeoutId = setTimeout(() => {
        if (hasInitialSyncRef.current) return; // Another effect already handled it
        hasInitialSyncRef.current = true;

        // Don't reset if:
        // 1. There are pending offline actions (offline mode)
        // 2. There's persisted state in localStorage (sleep/refresh recovery)
        // The useTimerPersistence hook will restore from localStorage if needed
        if (!hasPendingActions() && !hasPersistedTimerState()) {
          // No server timer, no offline queue, no persisted state - reset to idle
          syncFromServer(null);
        }
      }, 100); // Small delay to let BroadcastChannel/localStorage sync happen

      return () => clearTimeout(timeoutId);
    }
  }, [serverTimer, isLoadingTimer, syncFromServer]);

  // tRPC mutations
  const startMutation = api.activeTimer.start.useMutation({
    onSuccess: (data) => {
      confirmAction();
      // Invalidate to keep server query cache in sync with new timer
      void utils.activeTimer.getCurrent.invalidate();
      // Don't show toast if this is part of a task switch (switch shows its own toast)
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
      // If data is null, timer was already stopped (race condition) - silently ignore
      if (!data) {
        return;
      }
      // State already reset optimistically, just show toast and invalidate
      void utils.activeTimer.getCurrent.invalidate();
      void utils.timeEntry.getRecent.invalidate();
      void utils.timeEntry.getRecentGroupedByTask.invalidate();
      void utils.timeEntry.getFiltered.invalidate();
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
    onSuccess: (data) => {
      // If data is null, timer was already discarded (race condition) - silently ignore
      if (!data) {
        return;
      }
      // Invalidate server query cache
      void utils.activeTimer.getCurrent.invalidate();
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

  // Check if any mutation is in flight
  const isMutating =
    startMutation.isPending ||
    pauseMutation.isPending ||
    resumeMutation.isPending ||
    stopMutation.isPending ||
    discardMutation.isPending;

  // Action handlers with optimistic updates
  const handleStart = useCallback(
    (task: TimerTask) => {
      if (isMutating) return; // Prevent double-clicks
      previousStateRef.current = { ...timerState };
      startTimer(task);
      startMutation.mutate({ taskId: task.id });
    },
    [timerState, startTimer, startMutation, isMutating]
  );

  const handlePause = useCallback(() => {
    if (isMutating || !isRunning) return; // Prevent double-clicks or pausing when not running
    previousStateRef.current = { ...timerState };
    pauseTimer();
    pauseMutation.mutate();
  }, [timerState, pauseTimer, pauseMutation, isMutating, isRunning]);

  const handleResume = useCallback(() => {
    if (isMutating || !isPaused) return; // Prevent double-clicks or resuming when not paused
    previousStateRef.current = { ...timerState };
    resumeTimer();
    resumeMutation.mutate();
  }, [timerState, resumeTimer, resumeMutation, isMutating, isPaused]);

  const handleStop = useCallback(() => {
    if (isMutating || !isActive) return; // Prevent double-clicks or stopping when not active
    previousStateRef.current = { ...timerState };
    stopTimer();
    stopMutation.mutate();
  }, [timerState, stopTimer, stopMutation, isMutating, isActive]);

  const handleDiscard = useCallback(() => {
    if (isMutating || !isActive) return; // Prevent double-clicks or discarding when not active
    previousStateRef.current = { ...timerState };
    discardTimer();
    discardMutation.mutate();
  }, [timerState, discardTimer, discardMutation, isMutating, isActive]);

  // Switch to a different task (stops current, starts new)
  const handleSwitchTask = useCallback(
    (newTask: TimerTask) => {
      if (isMutating) return; // Prevent during mutation

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
          if (data) {
            void utils.timeEntry.getRecent.invalidate();
            void utils.timeEntry.getRecentGroupedByTask.invalidate();
            void utils.timeEntry.getFiltered.invalidate();
            void utils.stats.invalidate();
            toast.success("Switched tasks", {
              description: `${formatTimer(data.duration)} saved, now tracking "${newTask.title}"`,
            });
          }
          // Start the new timer only on success
          // Mark that we're switching so startMutation.onSuccess doesn't show duplicate toast
          isSwitchingRef.current = true;
          startTimer(newTask);
          startMutation.mutate({ taskId: newTask.id });
        },
        onError: (error) => {
          // Restore previous state on error
          if (previousStateRef.current) {
            rollbackTimer(previousStateRef.current);
          }
          toast.error("Failed to switch tasks", {
            description: error.message,
          });
          // Don't start new timer if stop failed
        },
      });
    },
    [
      isMutating,
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
    isMutating,
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
