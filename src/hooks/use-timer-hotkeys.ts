"use client";

import { useMemo } from "react";
import { useHotkeys } from "./use-hotkeys";
import { useTimer } from "./use-timer";

/**
 * Keyboard shortcuts for timer controls:
 * - Space: Pause/Resume timer (when active)
 * - S: Stop and save timer
 * - D: Discard timer
 */
export function useTimerHotkeys() {
  const { isActive, isRunning, isPaused, pause, resume, stop, discard } =
    useTimer();

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
