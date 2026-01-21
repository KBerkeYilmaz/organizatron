"use client";

import { useMemo } from "react";
import { useHotkeys } from "./use-hotkeys";
import { useTimerActions } from "./use-timer-actions";

/**
 * Keyboard shortcuts for timer controls:
 * - Space: Pause/Resume timer (when active)
 * - S: Stop and save timer
 * - D: Discard timer
 *
 * Uses useTimerActions for proper toast notifications and query invalidation.
 */
export function useTimerHotkeys() {
  const {
    isActive,
    isRunning,
    isPaused,
    pause,
    resume,
    stop,
    discard,
  } = useTimerActions();

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
