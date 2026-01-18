import { createStore } from "jotai";
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  timerStateAtom,
  displayTimeAtom,
  isTimerActiveAtom,
  isTimerRunningAtom,
  isTimerPausedAtom,
  startTimerAtom,
  pauseTimerAtom,
  resumeTimerAtom,
  stopTimerAtom,
  discardTimerAtom,
  confirmActionAtom,
  rollbackTimerAtom,
  syncFromServerAtom,
  lastDiscardedStateAtom,
  restoreDiscardedTimerAtom,
  type TimerTask,
  type TimerState,
} from "./timer-atoms";

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

describe("Timer Atoms", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T10:00:00.000Z"));
  });

  describe("Initial State", () => {
    it("should start with idle status", () => {
      const state = store.get(timerStateAtom);
      expect(state.status).toBe("idle");
      expect(state.taskId).toBeNull();
      expect(state.task).toBeNull();
      expect(state.startTime).toBeNull();
      expect(state.elapsed).toBe(0);
      expect(state.isPending).toBe(false);
      expect(state.pendingAction).toBeNull();
    });

    it("should have display time of 0 when idle", () => {
      expect(store.get(displayTimeAtom)).toBe(0);
    });

    it("should not be active when idle", () => {
      expect(store.get(isTimerActiveAtom)).toBe(false);
    });

    it("should not be running when idle", () => {
      expect(store.get(isTimerRunningAtom)).toBe(false);
    });

    it("should not be paused when idle", () => {
      expect(store.get(isTimerPausedAtom)).toBe(false);
    });
  });

  describe("Start Timer", () => {
    it("should start timer with task info", () => {
      store.set(startTimerAtom, mockTask);
      const state = store.get(timerStateAtom);

      expect(state.status).toBe("running");
      expect(state.taskId).toBe("task-1");
      expect(state.task).toEqual(mockTask);
      expect(state.startTime).toBe(Date.now());
      expect(state.elapsed).toBe(0);
      expect(state.isPending).toBe(true);
      expect(state.pendingAction).toBe("start");
    });

    it("should be active after starting", () => {
      store.set(startTimerAtom, mockTask);
      expect(store.get(isTimerActiveAtom)).toBe(true);
    });

    it("should be running after starting", () => {
      store.set(startTimerAtom, mockTask);
      expect(store.get(isTimerRunningAtom)).toBe(true);
    });
  });

  describe("Pause Timer", () => {
    beforeEach(() => {
      store.set(startTimerAtom, mockTask);
      // Advance time by 60 seconds
      vi.advanceTimersByTime(60000);
    });

    it("should pause running timer and calculate elapsed time", () => {
      store.set(pauseTimerAtom);
      const state = store.get(timerStateAtom);

      expect(state.status).toBe("paused");
      expect(state.elapsed).toBe(60); // 60 seconds
      expect(state.startTime).toBeNull();
      expect(state.isPending).toBe(true);
      expect(state.pendingAction).toBe("pause");
    });

    it("should be paused but still active", () => {
      store.set(pauseTimerAtom);
      expect(store.get(isTimerActiveAtom)).toBe(true);
      expect(store.get(isTimerPausedAtom)).toBe(true);
      expect(store.get(isTimerRunningAtom)).toBe(false);
    });

    it("should not pause if already idle", () => {
      store.set(timerStateAtom, {
        status: "idle",
        taskId: null,
        task: null,
        startTime: null,
        elapsed: 0,
        isPending: false,
        pendingAction: null,
      });
      store.set(pauseTimerAtom);
      expect(store.get(timerStateAtom).status).toBe("idle");
    });
  });

  describe("Resume Timer", () => {
    beforeEach(() => {
      store.set(startTimerAtom, mockTask);
      vi.advanceTimersByTime(60000);
      store.set(pauseTimerAtom);
      store.set(confirmActionAtom); // Clear pending
    });

    it("should resume paused timer", () => {
      store.set(resumeTimerAtom);
      const state = store.get(timerStateAtom);

      expect(state.status).toBe("running");
      expect(state.startTime).toBe(Date.now());
      expect(state.elapsed).toBe(60); // Preserved from pause
      expect(state.isPending).toBe(true);
      expect(state.pendingAction).toBe("resume");
    });

    it("should accumulate elapsed time across pause/resume cycles", () => {
      store.set(resumeTimerAtom);
      store.set(confirmActionAtom);
      vi.advanceTimersByTime(30000); // 30 more seconds
      store.set(pauseTimerAtom);

      const state = store.get(timerStateAtom);
      expect(state.elapsed).toBe(90); // 60 + 30
    });

    it("should not resume if not paused", () => {
      store.set(startTimerAtom, mockTask);
      const originalState = store.get(timerStateAtom);
      store.set(resumeTimerAtom);
      // Should not change state
      expect(store.get(timerStateAtom).pendingAction).toBe("start");
    });
  });

  describe("Stop Timer", () => {
    beforeEach(() => {
      store.set(startTimerAtom, mockTask);
      store.set(confirmActionAtom);
      vi.advanceTimersByTime(120000); // 2 minutes
    });

    it("should stop timer and return final elapsed time", () => {
      const finalElapsed = store.set(stopTimerAtom);
      expect(finalElapsed).toBe(120);
    });

    it("should reset to idle state immediately (optimistic)", () => {
      store.set(stopTimerAtom);
      const state = store.get(timerStateAtom);

      expect(state.status).toBe("idle");
      expect(state.taskId).toBeNull();
      expect(state.task).toBeNull();
      expect(state.elapsed).toBe(0);
    });

    it("should stop from paused state correctly", () => {
      store.set(pauseTimerAtom);
      store.set(confirmActionAtom);
      vi.advanceTimersByTime(30000); // Time passes while paused
      const finalElapsed = store.set(stopTimerAtom);

      // Should only count time until pause, not while paused
      expect(finalElapsed).toBe(120);
    });

    it("should not stop if already idle", () => {
      store.set(stopTimerAtom); // Stop first time
      const result = store.set(stopTimerAtom); // Try to stop again
      expect(result).toBeUndefined();
    });
  });

  describe("Discard Timer", () => {
    beforeEach(() => {
      store.set(startTimerAtom, mockTask);
      store.set(confirmActionAtom);
      vi.advanceTimersByTime(60000);
    });

    it("should discard timer and reset to idle", () => {
      store.set(discardTimerAtom);
      const state = store.get(timerStateAtom);

      expect(state.status).toBe("idle");
      expect(state.taskId).toBeNull();
    });

    it("should store discarded state for undo", () => {
      store.set(discardTimerAtom);
      const discarded = store.get(lastDiscardedStateAtom);

      expect(discarded).not.toBeNull();
      expect(discarded?.state.task).toEqual(mockTask);
      expect(discarded?.state.elapsed).toBe(60);
      expect(discarded?.state.status).toBe("paused"); // Stored as paused
    });

    it("should not discard if already idle", () => {
      store.set(discardTimerAtom); // Discard first time
      store.set(discardTimerAtom); // Try again
      // Should still have the original discarded state
      const discarded = store.get(lastDiscardedStateAtom);
      expect(discarded?.state.elapsed).toBe(60);
    });
  });

  describe("Restore Discarded Timer", () => {
    beforeEach(() => {
      store.set(startTimerAtom, mockTask);
      store.set(confirmActionAtom);
      vi.advanceTimersByTime(60000);
      store.set(discardTimerAtom);
    });

    it("should restore discarded timer within undo window", () => {
      const restored = store.set(restoreDiscardedTimerAtom);
      expect(restored).toBe(true);

      const state = store.get(timerStateAtom);
      expect(state.status).toBe("paused");
      expect(state.task).toEqual(mockTask);
      expect(state.elapsed).toBe(60);
    });

    it("should clear last discarded state after restore", () => {
      store.set(restoreDiscardedTimerAtom);
      expect(store.get(lastDiscardedStateAtom)).toBeNull();
    });

    it("should not restore after undo window expires (10 seconds)", () => {
      vi.advanceTimersByTime(11000); // 11 seconds
      const restored = store.set(restoreDiscardedTimerAtom);

      expect(restored).toBe(false);
      expect(store.get(timerStateAtom).status).toBe("idle");
    });

    it("should return false if no discarded state", () => {
      store.set(restoreDiscardedTimerAtom); // First restore
      const secondRestore = store.set(restoreDiscardedTimerAtom);
      expect(secondRestore).toBe(false);
    });
  });

  describe("Confirm Action", () => {
    it("should clear pending state for start/pause/resume", () => {
      store.set(startTimerAtom, mockTask);
      expect(store.get(timerStateAtom).isPending).toBe(true);

      store.set(confirmActionAtom);
      const state = store.get(timerStateAtom);

      expect(state.isPending).toBe(false);
      expect(state.pendingAction).toBeNull();
      expect(state.status).toBe("running"); // Still running
    });
  });

  describe("Rollback Timer", () => {
    it("should restore previous state on error", () => {
      store.set(startTimerAtom, mockTask);
      store.set(confirmActionAtom);
      vi.advanceTimersByTime(60000);

      const previousState: TimerState = {
        status: "running",
        taskId: mockTask.id,
        task: mockTask,
        startTime: Date.now() - 60000,
        elapsed: 0,
        isPending: false,
        pendingAction: null,
      };

      // Simulate pause then error
      store.set(pauseTimerAtom);
      store.set(rollbackTimerAtom, previousState);

      const state = store.get(timerStateAtom);
      expect(state.status).toBe("running");
      expect(state.isPending).toBe(false);
    });
  });

  describe("Sync From Server", () => {
    it("should sync server data to Jotai state", () => {
      const serverData = {
        id: "timer-1",
        taskId: "task-1",
        startTime: new Date("2024-01-15T09:50:00.000Z"),
        elapsed: 300, // 5 minutes accumulated
        isPaused: false,
        task: mockTask,
      };

      store.set(syncFromServerAtom, serverData);
      const state = store.get(timerStateAtom);

      expect(state.status).toBe("running");
      expect(state.taskId).toBe("task-1");
      expect(state.task).toEqual(mockTask);
      expect(state.elapsed).toBe(300);
      expect(state.isPending).toBe(false);
    });

    it("should sync paused state from server", () => {
      const serverData = {
        id: "timer-1",
        taskId: "task-1",
        startTime: new Date("2024-01-15T09:50:00.000Z"),
        elapsed: 600,
        isPaused: true,
        task: mockTask,
      };

      store.set(syncFromServerAtom, serverData);
      const state = store.get(timerStateAtom);

      expect(state.status).toBe("paused");
      expect(state.startTime).toBeNull(); // No startTime when paused
      expect(state.elapsed).toBe(600);
    });

    it("should reset to idle when syncing null", () => {
      // First set some state
      store.set(startTimerAtom, mockTask);
      store.set(confirmActionAtom);

      // Then sync null (no server timer)
      store.set(syncFromServerAtom, null);
      const state = store.get(timerStateAtom);

      expect(state.status).toBe("idle");
      expect(state.taskId).toBeNull();
      expect(state.task).toBeNull();
    });

    it("should NOT override pending state", () => {
      store.set(startTimerAtom, mockTask); // isPending = true

      const serverData = {
        id: "timer-1",
        taskId: "task-2", // Different task
        startTime: new Date(),
        elapsed: 0,
        isPaused: false,
        task: { ...mockTask, id: "task-2", title: "Different Task" },
      };

      store.set(syncFromServerAtom, serverData);
      const state = store.get(timerStateAtom);

      // Should not change because isPending
      expect(state.taskId).toBe("task-1");
      expect(state.isPending).toBe(true);
    });
  });

  describe("Display Time Calculation", () => {
    it("should return 0 when idle", () => {
      expect(store.get(displayTimeAtom)).toBe(0);
    });

    it("should return elapsed when paused", () => {
      store.set(startTimerAtom, mockTask);
      vi.advanceTimersByTime(45000);
      store.set(pauseTimerAtom);

      expect(store.get(displayTimeAtom)).toBe(45);
    });

    it("should calculate running time correctly", () => {
      store.set(startTimerAtom, mockTask);
      store.set(confirmActionAtom);
      vi.advanceTimersByTime(30000);

      // displayTimeAtom calculates elapsed + time since start
      expect(store.get(displayTimeAtom)).toBe(30);
    });

    it("should include accumulated elapsed when running after pause", () => {
      store.set(startTimerAtom, mockTask);
      store.set(confirmActionAtom);
      vi.advanceTimersByTime(60000);
      store.set(pauseTimerAtom);
      store.set(confirmActionAtom);
      store.set(resumeTimerAtom);
      store.set(confirmActionAtom);
      vi.advanceTimersByTime(30000);

      // 60 seconds from first run + 30 seconds from second run
      expect(store.get(displayTimeAtom)).toBe(90);
    });
  });
});
