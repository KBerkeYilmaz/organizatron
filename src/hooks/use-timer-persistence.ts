"use client";

import { useEffect, useRef } from "react";
import { useAtom } from "jotai";
import { timerStateAtom } from "~/store/timer-atoms";
import {
  saveTimerState,
  loadTimerState,
  clearTimerState,
} from "~/lib/timer-storage";

/**
 * Hook that persists timer state to localStorage.
 *
 * - On mount: loads persisted state if no server timer
 * - On state change: saves to localStorage (debounced)
 * - Handles PC sleep/wake by preserving startTime
 *
 * Place this in TimerProvider to enable persistence.
 */
export function useTimerPersistence() {
  const [timerState, setTimerState] = useAtom(timerStateAtom);
  const hasLoadedRef = useRef(false);
  const lastSavedRef = useRef<string>("");

  // Load persisted state on mount (before server sync)
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    const persisted = loadTimerState();
    if (!persisted) return;

    // Only restore if current state is idle (not already synced from server or other source)
    if (timerState.status !== "idle") return;

    const { state, savedAt } = persisted;

    // If it was running, we need to check if it's still valid
    // For running timers, the startTime is preserved and time calculation works correctly
    if (state.status === "running" && state.startTime) {
      // Calculate how long ago it was saved
      const timeSinceSave = Date.now() - savedAt;

      // If saved more than 24 hours ago, consider it stale and don't restore
      // (user probably forgot about it)
      if (timeSinceSave > 24 * 60 * 60 * 1000) {
        clearTimerState();
        return;
      }

      // Restore the running state - the display will automatically
      // calculate correct elapsed time from startTime
      setTimerState(state);
      return;
    }

    // For paused state, restore directly
    if (state.status === "paused") {
      setTimerState(state);
      return;
    }
  }, [timerState.status, setTimerState]);

  // Save state changes to localStorage
  useEffect(() => {
    // Don't save pending states
    if (timerState.isPending) return;

    // Create a simple hash to avoid unnecessary saves
    const stateHash = JSON.stringify({
      status: timerState.status,
      taskId: timerState.taskId,
      startTime: timerState.startTime,
      elapsed: timerState.elapsed,
    });

    // Skip if nothing changed
    if (stateHash === lastSavedRef.current) return;
    lastSavedRef.current = stateHash;

    // Save to localStorage
    saveTimerState(timerState);
  }, [timerState]);

  // Note: Visibility change handling for display updates is done in use-timer.ts
  // This hook only handles persistence, not display updates
}
