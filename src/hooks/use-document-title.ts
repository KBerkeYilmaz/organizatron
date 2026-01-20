"use client";

import { useEffect, useRef } from "react";
import { useAtomValue } from "jotai";
import {
  isTimerActiveAtom,
  isTimerRunningAtom,
  timerStateAtom,
} from "~/store/timer-atoms";
import { formatTimer } from "~/lib/format";

const BASE_TITLE = "Organizatron";

export function useDocumentTitle() {
  const isActive = useAtomValue(isTimerActiveAtom);
  const isRunning = useAtomValue(isTimerRunningAtom);
  const timerState = useAtomValue(timerStateAtom);

  // Use refs to avoid re-creating the interval on every state change
  const timerStateRef = useRef(timerState);
  timerStateRef.current = timerState;

  useEffect(() => {
    if (!isActive) {
      document.title = BASE_TITLE;
      return;
    }

    const updateTitle = () => {
      const state = timerStateRef.current;
      const time = formatTimer(
        state.startTime && state.status === "running"
          ? state.elapsed +
              Math.floor((Date.now() - state.startTime) / 1000)
          : state.elapsed
      );
      const icon = state.status === "running" ? "▶" : "⏸";
      const taskName = state.task?.title ?? "Timer";
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
  }, [isActive, isRunning]);
}
