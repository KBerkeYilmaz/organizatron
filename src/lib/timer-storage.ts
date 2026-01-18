/**
 * Timer State Persistence
 *
 * Persists timer state to localStorage so it survives:
 * - PC sleep/wake
 * - Browser tab being killed and reopened
 * - Browser crashes
 * - Page refreshes
 *
 * The server remains the source of truth, but this provides
 * better UX by preserving local state.
 */

import type { TimerState } from "~/store/timer-atoms";

const STORAGE_KEY = "organizatron-timer-state";

export interface PersistedTimerState {
  state: TimerState;
  savedAt: number; // timestamp when saved
}

/**
 * Save timer state to localStorage
 */
export function saveTimerState(state: TimerState): void {
  if (typeof window === "undefined") return;

  // Don't persist idle state - just clear storage
  if (state.status === "idle") {
    clearTimerState();
    return;
  }

  // Don't persist pending states - wait for confirmation
  if (state.isPending) {
    return;
  }

  try {
    const persisted: PersistedTimerState = {
      state,
      savedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  } catch (error) {
    console.error("Failed to save timer state:", error);
  }
}

/**
 * Load timer state from localStorage
 */
export function loadTimerState(): PersistedTimerState | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const persisted: PersistedTimerState = JSON.parse(stored);

    // Validate the structure
    if (!persisted.state || !persisted.savedAt) {
      clearTimerState();
      return null;
    }

    // Validate state has required fields
    if (!persisted.state.status || !persisted.state.task) {
      clearTimerState();
      return null;
    }

    return persisted;
  } catch (error) {
    console.error("Failed to load timer state:", error);
    clearTimerState();
    return null;
  }
}

/**
 * Clear persisted timer state
 */
export function clearTimerState(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear timer state:", error);
  }
}

/**
 * Check if there's persisted timer state
 */
export function hasPersistedTimerState(): boolean {
  return loadTimerState() !== null;
}
