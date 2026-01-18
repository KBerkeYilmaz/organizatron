import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getQueuedActions,
  queueAction,
  removeAction,
  incrementRetry,
  clearQueue,
  hasPendingActions,
  type QueuedAction,
} from "./offline-queue";

// Create a fresh localStorage mock for each test
function createLocalStorageMock() {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach(key => delete store[key]);
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
}

// Mock crypto.randomUUID
let uuidCounter = 0;
vi.stubGlobal("crypto", {
  randomUUID: () => `uuid-${++uuidCounter}`,
});

describe("Offline Queue", () => {
  beforeEach(() => {
    uuidCounter = 0;
    const localStorageMock = createLocalStorageMock();
    // Mock window to make typeof window !== "undefined"
    vi.stubGlobal("window", { localStorage: localStorageMock });
    vi.stubGlobal("localStorage", localStorageMock);
  });

  describe("getQueuedActions", () => {
    it("should return empty array when no actions queued", () => {
      expect(getQueuedActions()).toEqual([]);
    });

    it("should return queued actions from localStorage", () => {
      const actions: QueuedAction[] = [
        { id: "1", type: "start", payload: { taskId: "task-1" }, timestamp: Date.now(), retries: 0 },
      ];
      localStorage.setItem("organizatron-offline-queue", JSON.stringify(actions));

      expect(getQueuedActions()).toEqual(actions);
    });

    it("should handle invalid JSON gracefully", () => {
      localStorage.setItem("organizatron-offline-queue", "invalid json");
      expect(getQueuedActions()).toEqual([]);
    });
  });

  describe("queueAction", () => {
    it("should queue a start action", () => {
      const action = queueAction("start", { taskId: "task-1" });

      expect(action.type).toBe("start");
      expect(action.payload).toEqual({ taskId: "task-1" });
      expect(action.retries).toBe(0);
      expect(getQueuedActions().length).toBe(1);
    });

    it("should queue a pause action", () => {
      const action = queueAction("pause");

      expect(action.type).toBe("pause");
      expect(action.payload).toBeUndefined();
    });

    it("should queue a resume action", () => {
      const action = queueAction("resume");
      expect(action.type).toBe("resume");
    });

    it("should queue a stop action", () => {
      const action = queueAction("stop");
      expect(action.type).toBe("stop");
    });

    it("should queue a discard action", () => {
      const action = queueAction("discard");
      expect(action.type).toBe("discard");
    });
  });

  describe("Queue Optimization", () => {
    it("should cancel out pause + resume", () => {
      queueAction("pause");
      queueAction("resume");

      const actions = getQueuedActions();
      expect(actions.length).toBe(0);
    });

    it("should cancel out resume + pause", () => {
      queueAction("resume");
      queueAction("pause");

      const actions = getQueuedActions();
      expect(actions.length).toBe(0);
    });

    it("should clear queue on stop", () => {
      queueAction("start", { taskId: "task-1" });
      queueAction("pause");
      queueAction("resume");
      queueAction("stop");

      const actions = getQueuedActions();
      expect(actions.length).toBe(1);
      expect(actions[0]?.type).toBe("stop");
    });

    it("should clear queue on discard", () => {
      queueAction("start", { taskId: "task-1" });
      queueAction("pause");
      queueAction("discard");

      const actions = getQueuedActions();
      expect(actions.length).toBe(1);
      expect(actions[0]?.type).toBe("discard");
    });

    it("should clear all actions on stop (single active timer)", () => {
      queueAction("start", { taskId: "task-1" });
      queueAction("pause");
      queueAction("stop");

      const actions = getQueuedActions();
      // Stop clears everything - only stop remains
      expect(actions.length).toBe(1);
      expect(actions[0]?.type).toBe("stop");
    });
  });

  describe("removeAction", () => {
    it("should remove action by id", () => {
      const action = queueAction("start", { taskId: "task-1" });
      expect(getQueuedActions().length).toBe(1);

      removeAction(action.id);
      expect(getQueuedActions().length).toBe(0);
    });

    it("should only remove the specified action", () => {
      // Queue multiple actions - use start with different taskIds to avoid optimization
      const action1 = queueAction("start", { taskId: "task-1" });
      queueAction("start", { taskId: "task-2" });

      expect(getQueuedActions().length).toBe(2);

      // Remove first action
      removeAction(action1.id);

      const remaining = getQueuedActions();
      expect(remaining.length).toBe(1);
      expect(remaining[0]?.payload?.taskId).toBe("task-2");
    });
  });

  describe("incrementRetry", () => {
    it("should increment retry count", () => {
      const action = queueAction("pause");
      const canRetry = incrementRetry(action.id);

      expect(canRetry).toBe(true);
      const actions = getQueuedActions();
      expect(actions[0]?.retries).toBe(1);
    });

    it("should return false and remove after max retries (3)", () => {
      const action = queueAction("pause");

      incrementRetry(action.id); // retries = 1
      incrementRetry(action.id); // retries = 2
      const canRetry = incrementRetry(action.id); // retries = 3, removed

      expect(canRetry).toBe(false);
      expect(getQueuedActions().length).toBe(0);
    });

    it("should return false for non-existent action", () => {
      expect(incrementRetry("non-existent")).toBe(false);
    });
  });

  describe("clearQueue", () => {
    it("should clear all actions", () => {
      queueAction("start", { taskId: "task-1" });
      queueAction("pause");

      clearQueue();
      expect(getQueuedActions().length).toBe(0);
    });
  });

  describe("hasPendingActions", () => {
    it("should return false when queue is empty", () => {
      expect(hasPendingActions()).toBe(false);
    });

    it("should return true when actions are queued", () => {
      queueAction("start", { taskId: "task-1" });
      expect(hasPendingActions()).toBe(true);
    });
  });

  describe("Offline Workflow Scenarios", () => {
    it("should handle complete offline timer session", () => {
      // User starts timer offline
      queueAction("start", { taskId: "task-1" });
      expect(hasPendingActions()).toBe(true);

      // User pauses
      queueAction("pause");

      // User resumes (cancels out pause)
      queueAction("resume");

      // Only start remains
      let actions = getQueuedActions();
      expect(actions.length).toBe(1);
      expect(actions[0]?.type).toBe("start");

      // User stops timer
      queueAction("stop");

      // Should have start and stop (stop doesn't cancel start)
      actions = getQueuedActions();
      expect(actions.length).toBe(1);
      expect(actions[0]?.type).toBe("stop");
    });

    it("should handle multiple pause/resume cycles", () => {
      queueAction("pause");
      queueAction("resume");
      queueAction("pause");
      queueAction("resume");
      queueAction("pause");

      // All resume/pause pairs cancel, leaving one pause
      const actions = getQueuedActions();
      expect(actions.length).toBe(1);
      expect(actions[0]?.type).toBe("pause");
    });

    it("should handle discard clearing previous actions", () => {
      queueAction("start", { taskId: "task-1" });
      queueAction("pause");
      queueAction("resume");
      queueAction("pause");
      queueAction("discard");

      // Discard should clear everything except itself
      const actions = getQueuedActions();
      expect(actions.length).toBe(1);
      expect(actions[0]?.type).toBe("discard");
    });
  });
});
