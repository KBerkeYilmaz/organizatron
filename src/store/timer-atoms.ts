import { atom } from "jotai";

// Types for timer state
export interface TimerTask {
  id: string;
  title: string;
  project: {
    id: string;
    name: string;
    client: {
      id: string;
      name: string;
      color: string;
    };
  };
  // Billing info (optional for backwards compat)
  isBillable?: boolean;
  hourlyRate?: number | null; // in cents
  currency?: string;
}

export type TimerStatus = "idle" | "running" | "paused";

export interface TimerState {
  status: TimerStatus;
  taskId: string | null;
  task: TimerTask | null;
  startTime: number | null; // timestamp in ms
  elapsed: number; // accumulated seconds (from pauses)
  isPending: boolean; // for optimistic UI during mutations
  pendingAction: "start" | "pause" | "resume" | "stop" | "discard" | null;
}

// Initial state
const initialTimerState: TimerState = {
  status: "idle",
  taskId: null,
  task: null,
  startTime: null,
  elapsed: 0,
  isPending: false,
  pendingAction: null,
};

// Base timer state atom
export const timerStateAtom = atom<TimerState>(initialTimerState);

// Store last discarded state for undo functionality
export const lastDiscardedStateAtom = atom<{
  state: TimerState;
  timestamp: number;
} | null>(null);

// Derived atom: current display time (computed from state)
export const displayTimeAtom = atom((get) => {
  const state = get(timerStateAtom);

  if (state.status === "idle") {
    return 0;
  }

  if (state.status === "paused") {
    return state.elapsed;
  }

  // Running: elapsed + time since startTime
  if (state.startTime) {
    const timeSinceStart = Math.floor((Date.now() - state.startTime) / 1000);
    return state.elapsed + timeSinceStart;
  }

  return state.elapsed;
});

// Derived atom: is timer active (running or paused)
export const isTimerActiveAtom = atom((get) => {
  const state = get(timerStateAtom);
  return state.status !== "idle";
});

// Derived atom: is timer running
export const isTimerRunningAtom = atom((get) => {
  const state = get(timerStateAtom);
  return state.status === "running";
});

// Derived atom: is timer paused
export const isTimerPausedAtom = atom((get) => {
  const state = get(timerStateAtom);
  return state.status === "paused";
});

// Action atoms for optimistic updates
export const startTimerAtom = atom(
  null,
  (get, set, task: TimerTask) => {
    set(timerStateAtom, {
      status: "running",
      taskId: task.id,
      task,
      startTime: Date.now(),
      elapsed: 0,
      isPending: true,
      pendingAction: "start",
    });
  }
);

export const pauseTimerAtom = atom(null, (get, set) => {
  const current = get(timerStateAtom);
  if (current.status !== "running" || !current.startTime) return;

  // Calculate elapsed time up to now
  const timeSinceStart = Math.floor((Date.now() - current.startTime) / 1000);
  const totalElapsed = current.elapsed + timeSinceStart;

  set(timerStateAtom, {
    ...current,
    status: "paused",
    elapsed: totalElapsed,
    startTime: null,
    isPending: true,
    pendingAction: "pause",
  });
});

export const resumeTimerAtom = atom(null, (get, set) => {
  const current = get(timerStateAtom);
  if (current.status !== "paused") return;

  set(timerStateAtom, {
    ...current,
    status: "running",
    startTime: Date.now(),
    isPending: true,
    pendingAction: "resume",
  });
});

export const stopTimerAtom = atom(null, (get, set) => {
  const current = get(timerStateAtom);
  if (current.status === "idle") return;

  // Calculate final elapsed time for display before reset
  let finalElapsed = current.elapsed;
  if (current.status === "running" && current.startTime) {
    const timeSinceStart = Math.floor((Date.now() - current.startTime) / 1000);
    finalElapsed = current.elapsed + timeSinceStart;
  }

  // Immediately reset to idle (optimistic)
  set(timerStateAtom, initialTimerState);

  return finalElapsed;
});

export const discardTimerAtom = atom(null, (get, set) => {
  const current = get(timerStateAtom);
  if (current.status === "idle") return;

  // Store state for undo (with current elapsed calculated)
  let finalElapsed = current.elapsed;
  if (current.status === "running" && current.startTime) {
    const timeSinceStart = Math.floor((Date.now() - current.startTime) / 1000);
    finalElapsed = current.elapsed + timeSinceStart;
  }

  set(lastDiscardedStateAtom, {
    state: {
      ...current,
      status: "paused", // Store as paused so it doesn't auto-resume
      elapsed: finalElapsed,
      startTime: null,
      isPending: false,
      pendingAction: null,
    },
    timestamp: Date.now(),
  });

  // Immediately reset to idle (optimistic)
  set(timerStateAtom, initialTimerState);
});

// Confirm action succeeded (server confirmed)
export const confirmActionAtom = atom(null, (get, set) => {
  const current = get(timerStateAtom);

  if (current.pendingAction === "stop" || current.pendingAction === "discard") {
    // Reset to idle on stop/discard
    set(timerStateAtom, initialTimerState);
  } else {
    // Just clear pending state for other actions
    set(timerStateAtom, {
      ...current,
      isPending: false,
      pendingAction: null,
    });
  }
});

// Rollback on error (revert to previous state)
export const rollbackTimerAtom = atom(
  null,
  (get, set, previousState: TimerState) => {
    set(timerStateAtom, {
      ...previousState,
      isPending: false,
      pendingAction: null,
    });
  }
);

// Sync from server data (initial load or refetch)
export const syncFromServerAtom = atom(
  null,
  (
    get,
    set,
    serverData: {
      id: string;
      taskId: string;
      startTime: Date;
      elapsed: number;
      isPaused: boolean;
      task: TimerTask;
    } | null
  ) => {
    if (!serverData) {
      set(timerStateAtom, initialTimerState);
      return;
    }

    const current = get(timerStateAtom);

    // Don't override if we have a pending action
    if (current.isPending) return;

    const serverStartTime = new Date(serverData.startTime).getTime();

    set(timerStateAtom, {
      status: serverData.isPaused ? "paused" : "running",
      taskId: serverData.taskId,
      task: serverData.task,
      startTime: serverData.isPaused ? null : serverStartTime,
      elapsed: serverData.elapsed,
      isPending: false,
      pendingAction: null,
    });
  }
);

// Reset timer state completely
export const resetTimerAtom = atom(null, (get, set) => {
  set(timerStateAtom, initialTimerState);
});

// Restore discarded timer (undo)
const UNDO_TIMEOUT_MS = 10000; // 10 seconds to undo

export const restoreDiscardedTimerAtom = atom(null, (get, set) => {
  const discarded = get(lastDiscardedStateAtom);
  if (!discarded) return false;

  // Check if undo window has expired
  if (Date.now() - discarded.timestamp > UNDO_TIMEOUT_MS) {
    set(lastDiscardedStateAtom, null);
    return false;
  }

  // Restore the timer state
  set(timerStateAtom, discarded.state);
  set(lastDiscardedStateAtom, null);
  return true;
});

// Clear discarded state (called when undo window expires or new timer starts)
export const clearDiscardedStateAtom = atom(null, (_get, set) => {
  set(lastDiscardedStateAtom, null);
});
