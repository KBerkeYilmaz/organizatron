"use client";

import { useMemo, useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { useHotkeys } from "./use-hotkeys";
import {
  timerStateAtom,
  pauseTimerAtom,
  resumeTimerAtom,
  stopTimerAtom,
  discardTimerAtom,
} from "~/store/timer-atoms";
import { api } from "~/trpc/react";

/**
 * Keyboard shortcuts for timer controls:
 * - Space: Pause/Resume timer (when active)
 * - S: Stop and save timer
 * - D: Discard timer
 *
 * This hook directly uses atoms instead of useTimer() to avoid
 * creating duplicate timer intervals for display updates.
 */
export function useTimerHotkeys() {
  // Read state directly from atom (no interval needed for hotkeys)
  const timerState = useAtomValue(timerStateAtom);
  const isActive = timerState.status !== "idle";
  const isRunning = timerState.status === "running";
  const isPaused = timerState.status === "paused";

  // Action atoms
  const pauseTimer = useSetAtom(pauseTimerAtom);
  const resumeTimer = useSetAtom(resumeTimerAtom);
  const stopTimer = useSetAtom(stopTimerAtom);
  const discardTimer = useSetAtom(discardTimerAtom);

  // tRPC mutations for server sync
  const pauseMutation = api.activeTimer.pause.useMutation();
  const resumeMutation = api.activeTimer.resume.useMutation();
  const stopMutation = api.activeTimer.stop.useMutation();
  const discardMutation = api.activeTimer.discard.useMutation();

  // Wrapped actions that do optimistic update + server call
  const pause = useCallback(() => {
    if (timerState.status !== "running") return;
    pauseTimer();
    pauseMutation.mutate();
  }, [timerState.status, pauseTimer, pauseMutation]);

  const resume = useCallback(() => {
    if (timerState.status !== "paused") return;
    resumeTimer();
    resumeMutation.mutate();
  }, [timerState.status, resumeTimer, resumeMutation]);

  const stop = useCallback(() => {
    if (timerState.status === "idle") return;
    stopTimer();
    stopMutation.mutate();
  }, [timerState.status, stopTimer, stopMutation]);

  const discard = useCallback(() => {
    if (timerState.status === "idle") return;
    discardTimer();
    discardMutation.mutate();
  }, [timerState.status, discardTimer, discardMutation]);

  const hotkeys = useMemo(
    () => [
      {
        key: " ", // Space
        handler: () => {
          if (isRunning) {
            pause();
          } else if (isPaused) {
            resume();
          }
        },
        enabled: isActive,
        preventDefault: true, // Prevent page scroll
      },
      {
        key: "s",
        handler: stop,
        enabled: isActive,
      },
      {
        key: "d",
        handler: discard,
        enabled: isActive,
      },
    ],
    [isActive, isRunning, isPaused, pause, resume, stop, discard]
  );

  useHotkeys(hotkeys);
}
