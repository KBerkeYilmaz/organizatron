/**
 * Offline Action Queue
 *
 * Queues timer actions when offline and syncs when back online.
 * Actions are persisted to localStorage to survive page refreshes.
 */

export type QueuedActionType =
  | "start"
  | "pause"
  | "resume"
  | "stop"
  | "discard";

export interface QueuedAction {
  id: string;
  type: QueuedActionType;
  payload?: { taskId: string };
  timestamp: number;
  retries: number;
}

const STORAGE_KEY = "organizatron-offline-queue";
const MAX_RETRIES = 3;

/**
 * Get all queued actions from localStorage
 */
export function getQueuedActions(): QueuedAction[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Save queued actions to localStorage
 */
function saveQueuedActions(actions: QueuedAction[]): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
  } catch (error) {
    console.error("Failed to save offline queue:", error);
  }
}

/**
 * Add an action to the queue
 */
export function queueAction(
  type: QueuedActionType,
  payload?: { taskId: string }
): QueuedAction {
  const action: QueuedAction = {
    id: crypto.randomUUID(),
    type,
    payload,
    timestamp: Date.now(),
    retries: 0,
  };

  const actions = getQueuedActions();

  // Optimize queue: remove redundant actions
  // e.g., if we queue pause then resume, they cancel out
  const optimizedActions = optimizeQueue([...actions, action]);

  saveQueuedActions(optimizedActions);
  return action;
}

/**
 * Remove an action from the queue (after successful sync)
 */
export function removeAction(actionId: string): void {
  const actions = getQueuedActions();
  const filtered = actions.filter((a) => a.id !== actionId);
  saveQueuedActions(filtered);
}

/**
 * Mark an action as retried
 */
export function incrementRetry(actionId: string): boolean {
  const actions = getQueuedActions();
  const action = actions.find((a) => a.id === actionId);

  if (!action) return false;

  action.retries += 1;

  if (action.retries >= MAX_RETRIES) {
    // Remove action after max retries
    saveQueuedActions(actions.filter((a) => a.id !== actionId));
    return false;
  }

  saveQueuedActions(actions);
  return true;
}

/**
 * Clear all queued actions
 */
export function clearQueue(): void {
  saveQueuedActions([]);
}

/**
 * Check if there are pending actions
 */
export function hasPendingActions(): boolean {
  return getQueuedActions().length > 0;
}

/**
 * Optimize the queue by removing redundant actions
 * e.g., pause followed by resume = no-op
 */
function optimizeQueue(actions: QueuedAction[]): QueuedAction[] {
  const result: QueuedAction[] = [];

  for (const action of actions) {
    const last = result[result.length - 1];

    // Pause + Resume = cancel both
    if (last?.type === "pause" && action.type === "resume") {
      result.pop();
      continue;
    }

    // Resume + Pause = cancel both
    if (last?.type === "resume" && action.type === "pause") {
      result.pop();
      continue;
    }

    // Stop or Discard clears everything before it
    if (action.type === "stop" || action.type === "discard") {
      // Keep only start actions that aren't for the stopped task
      const startActions = result.filter(
        (a) => a.type === "start" && a.payload?.taskId !== action.payload?.taskId
      );
      result.length = 0;
      result.push(...startActions, action);
      continue;
    }

    result.push(action);
  }

  return result;
}
