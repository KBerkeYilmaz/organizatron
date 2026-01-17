"use client";

import { useEffect } from "react";
import { useAtomValue } from "jotai";
import {
  isTimerActiveAtom,
  isTimerRunningAtom,
  isTimerPausedAtom,
  timerStateAtom,
  displayTimeAtom,
} from "~/store/timer-atoms";
import { formatTimer } from "~/lib/format";

const BASE_TITLE = "Organizatron";

export function useDocumentTitle() {
  const isActive = useAtomValue(isTimerActiveAtom);
  const isRunning = useAtomValue(isTimerRunningAtom);
  const isPaused = useAtomValue(isTimerPausedAtom);
  const timerState = useAtomValue(timerStateAtom);
  const displayTime = useAtomValue(displayTimeAtom);

  useEffect(() => {
    if (!isActive) {
      document.title = BASE_TITLE;
      return;
    }

    const updateTitle = () => {
      const time = formatTimer(
        timerState.startTime && !isPaused
          ? timerState.elapsed +
              Math.floor((Date.now() - timerState.startTime) / 1000)
          : timerState.elapsed
      );
      const icon = isRunning ? "▶" : "⏸";
      const taskName = timerState.task?.title ?? "Timer";
      document.title = `${icon} ${time} - ${taskName} | ${BASE_TITLE}`;
    };

    // Update immediately
    updateTitle();

    // Update every second while running
    if (isRunning) {
      const interval = setInterval(updateTitle, 1000);
      return () => {
        clearInterval(interval);
        document.title = BASE_TITLE;
      };
    }

    return () => {
      document.title = BASE_TITLE;
    };
  }, [isActive, isRunning, isPaused, timerState, displayTime]);
}
