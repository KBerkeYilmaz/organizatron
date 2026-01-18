import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  saveTimerState,
  loadTimerState,
  clearTimerState,
  hasPersistedTimerState,
  type PersistedTimerState,
} from "./timer-storage";
import type { TimerState, TimerTask } from "~/store/timer-atoms";

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
      Object.keys(store).forEach((key) => delete store[key]);
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
}

const mockTask: TimerTask = {
  id: "task-1",
  title: "Test Task",
  project: {
    id: "project-1",
    name: "Test Project",
    client: {
      id: "client-1",
      name: "Test Client",
      color: "#ff0000",
    },
  },
};

const createTimerState = (overrides: Partial<TimerState> = {}): TimerState => ({
  status: "running",
  taskId: "task-1",
  task: mockTask,
  startTime: Date.now(),
  elapsed: 0,
  isPending: false,
  pendingAction: null,
  ...overrides,
});

describe("Timer Storage", () => {
  beforeEach(() => {
    const localStorageMock = createLocalStorageMock();
    vi.stubGlobal("window", { localStorage: localStorageMock });
    vi.stubGlobal("localStorage", localStorageMock);
  });

  describe("saveTimerState", () => {
    it("should save running timer state to localStorage", () => {
      const state = createTimerState({ status: "running" });
      saveTimerState(state);

      const stored = localStorage.getItem("organizatron-timer-state");
      expect(stored).not.toBeNull();

      const parsed: PersistedTimerState = JSON.parse(stored!);
      expect(parsed.state.status).toBe("running");
      expect(parsed.state.taskId).toBe("task-1");
      expect(parsed.savedAt).toBeGreaterThan(0);
    });

    it("should save paused timer state to localStorage", () => {
      const state = createTimerState({
        status: "paused",
        elapsed: 120,
        startTime: null,
      });
      saveTimerState(state);

      const stored = localStorage.getItem("organizatron-timer-state");
      const parsed: PersistedTimerState = JSON.parse(stored!);
      expect(parsed.state.status).toBe("paused");
      expect(parsed.state.elapsed).toBe(120);
    });

    it("should NOT save idle state - clears storage instead", () => {
      // First save a running state
      const runningState = createTimerState({ status: "running" });
      saveTimerState(runningState);
      expect(localStorage.getItem("organizatron-timer-state")).not.toBeNull();

      // Then save idle state
      const idleState = createTimerState({
        status: "idle",
        taskId: null,
        task: null,
        startTime: null,
        elapsed: 0,
      });
      saveTimerState(idleState);

      // Should be cleared
      expect(localStorage.getItem("organizatron-timer-state")).toBeNull();
    });

    it("should NOT save pending states", () => {
      const state = createTimerState({
        status: "running",
        isPending: true,
        pendingAction: "start",
      });
      saveTimerState(state);

      // Should not be saved
      expect(localStorage.getItem("organizatron-timer-state")).toBeNull();
    });
  });

  describe("loadTimerState", () => {
    it("should load persisted timer state", () => {
      const state = createTimerState({ status: "running", elapsed: 60 });
      const persisted: PersistedTimerState = {
        state,
        savedAt: Date.now(),
      };
      localStorage.setItem(
        "organizatron-timer-state",
        JSON.stringify(persisted)
      );

      const loaded = loadTimerState();
      expect(loaded).not.toBeNull();
      expect(loaded?.state.status).toBe("running");
      expect(loaded?.state.elapsed).toBe(60);
      expect(loaded?.savedAt).toBeGreaterThan(0);
    });

    it("should return null when no persisted state", () => {
      expect(loadTimerState()).toBeNull();
    });

    it("should return null and clear storage for invalid JSON", () => {
      localStorage.setItem("organizatron-timer-state", "invalid json");
      expect(loadTimerState()).toBeNull();
      expect(localStorage.getItem("organizatron-timer-state")).toBeNull();
    });

    it("should return null and clear storage for invalid structure", () => {
      localStorage.setItem(
        "organizatron-timer-state",
        JSON.stringify({ invalid: true })
      );
      expect(loadTimerState()).toBeNull();
      expect(localStorage.getItem("organizatron-timer-state")).toBeNull();
    });

    it("should return null and clear storage when state missing task", () => {
      const persisted = {
        state: {
          status: "running",
          taskId: "task-1",
          task: null, // Missing task
          startTime: Date.now(),
          elapsed: 0,
          isPending: false,
          pendingAction: null,
        },
        savedAt: Date.now(),
      };
      localStorage.setItem(
        "organizatron-timer-state",
        JSON.stringify(persisted)
      );

      expect(loadTimerState()).toBeNull();
    });
  });

  describe("clearTimerState", () => {
    it("should remove persisted state from localStorage", () => {
      const state = createTimerState();
      saveTimerState(state);
      expect(localStorage.getItem("organizatron-timer-state")).not.toBeNull();

      clearTimerState();
      expect(localStorage.getItem("organizatron-timer-state")).toBeNull();
    });

    it("should not throw when no state to clear", () => {
      expect(() => clearTimerState()).not.toThrow();
    });
  });

  describe("hasPersistedTimerState", () => {
    it("should return true when state is persisted", () => {
      const state = createTimerState();
      saveTimerState(state);
      expect(hasPersistedTimerState()).toBe(true);
    });

    it("should return false when no state persisted", () => {
      expect(hasPersistedTimerState()).toBe(false);
    });

    it("should return false for invalid persisted data", () => {
      localStorage.setItem("organizatron-timer-state", "invalid");
      expect(hasPersistedTimerState()).toBe(false);
    });
  });

  describe("PC Sleep/Wake Scenarios", () => {
    it("should preserve startTime for correct elapsed calculation after wake", () => {
      // Simulate starting a timer
      const startTime = Date.now() - 3600000; // 1 hour ago
      const state = createTimerState({
        status: "running",
        startTime,
        elapsed: 0,
      });
      saveTimerState(state);

      // Simulate loading after wake
      const loaded = loadTimerState();
      expect(loaded).not.toBeNull();
      expect(loaded?.state.startTime).toBe(startTime);

      // The UI would calculate: Date.now() - startTime = ~1 hour
      // This verifies the startTime is preserved correctly
    });

    it("should preserve elapsed time for paused timers", () => {
      const state = createTimerState({
        status: "paused",
        startTime: null,
        elapsed: 1800, // 30 minutes
      });
      saveTimerState(state);

      const loaded = loadTimerState();
      expect(loaded?.state.elapsed).toBe(1800);
      expect(loaded?.state.status).toBe("paused");
    });

    it("should preserve task info after reload", () => {
      const state = createTimerState({
        task: {
          id: "task-123",
          title: "Important Task",
          project: {
            id: "proj-1",
            name: "Big Project",
            client: {
              id: "client-1",
              name: "VIP Client",
              color: "#00ff00",
            },
          },
        },
      });
      saveTimerState(state);

      const loaded = loadTimerState();
      expect(loaded?.state.task?.id).toBe("task-123");
      expect(loaded?.state.task?.title).toBe("Important Task");
      expect(loaded?.state.task?.project.name).toBe("Big Project");
      expect(loaded?.state.task?.project.client.name).toBe("VIP Client");
    });
  });

  describe("Edge Cases", () => {
    it("should handle saving multiple times (overwrites)", () => {
      const state1 = createTimerState({ elapsed: 100 });
      saveTimerState(state1);

      const state2 = createTimerState({ elapsed: 200 });
      saveTimerState(state2);

      const loaded = loadTimerState();
      expect(loaded?.state.elapsed).toBe(200);
    });

    it("should save timestamp for staleness checking", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-15T10:00:00.000Z"));

      const state = createTimerState();
      saveTimerState(state);

      const loaded = loadTimerState();
      expect(loaded?.savedAt).toBe(new Date("2024-01-15T10:00:00.000Z").getTime());

      vi.useRealTimers();
    });
  });
});
