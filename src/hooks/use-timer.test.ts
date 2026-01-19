/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { createElement, type ReactNode } from "react";
import { type TimerTask } from "~/store/timer-atoms";

// Mock task for testing
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

const mockTask2: TimerTask = {
  id: "task-2",
  title: "Another Task",
  project: {
    id: "project-2",
    name: "Another Project",
    client: {
      id: "client-2",
      name: "Another Client",
      color: "#00ff00",
    },
  },
};

// Mock tRPC
const mockStartMutate = vi.fn();
const mockPauseMutate = vi.fn();
const mockResumeMutate = vi.fn();
const mockStopMutate = vi.fn();
const mockDiscardMutate = vi.fn();
const mockInvalidate = vi.fn();

// Track callbacks for manual triggering
let startOnSuccess: ((data: unknown) => void) | undefined;
let startOnError: ((error: Error) => void) | undefined;
let pauseOnSuccess: (() => void) | undefined;
let pauseOnError: ((error: Error) => void) | undefined;
let resumeOnSuccess: (() => void) | undefined;
let resumeOnError: ((error: Error) => void) | undefined;
let stopOnSuccess: ((data: unknown) => void) | undefined;
let stopOnError: ((error: Error) => void) | undefined;
let discardOnSuccess: ((data: unknown) => void) | undefined;
let discardOnError: ((error: Error) => void) | undefined;

vi.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({
      activeTimer: {
        getCurrent: { invalidate: mockInvalidate },
      },
      timeEntry: {
        getRecent: { invalidate: mockInvalidate },
        getRecentGroupedByTask: { invalidate: mockInvalidate },
        getFiltered: { invalidate: mockInvalidate },
      },
      stats: { invalidate: mockInvalidate },
    }),
    activeTimer: {
      getCurrent: {
        useQuery: () => ({
          data: null,
          isLoading: false,
        }),
      },
      start: {
        useMutation: ({ onSuccess, onError }: { onSuccess?: (data: unknown) => void; onError?: (error: Error) => void }) => {
          startOnSuccess = onSuccess;
          startOnError = onError;
          return {
            mutate: (input: { taskId: string }) => {
              mockStartMutate(input);
            },
            isPending: false,
          };
        },
      },
      pause: {
        useMutation: ({ onSuccess, onError }: { onSuccess?: () => void; onError?: (error: Error) => void }) => {
          pauseOnSuccess = onSuccess;
          pauseOnError = onError;
          return {
            mutate: () => {
              mockPauseMutate();
            },
            isPending: false,
          };
        },
      },
      resume: {
        useMutation: ({ onSuccess, onError }: { onSuccess?: () => void; onError?: (error: Error) => void }) => {
          resumeOnSuccess = onSuccess;
          resumeOnError = onError;
          return {
            mutate: () => {
              mockResumeMutate();
            },
            isPending: false,
          };
        },
      },
      stop: {
        useMutation: ({ onSuccess: globalOnSuccess, onError: globalOnError }: { onSuccess?: (data: unknown) => void; onError?: (error: Error) => void }) => {
          return {
            mutate: (_input: unknown, callbacks?: { onSuccess?: (data: unknown) => void; onError?: (error: Error) => void }) => {
              mockStopMutate();
              // Combine inline + global callbacks, preferring inline for switchTask
              stopOnSuccess = (data) => {
                callbacks?.onSuccess?.(data);
                globalOnSuccess?.(data);
              };
              stopOnError = (error) => {
                callbacks?.onError?.(error);
                globalOnError?.(error);
              };
            },
            isPending: false,
          };
        },
      },
      discard: {
        useMutation: ({ onSuccess, onError }: { onSuccess?: (data: unknown) => void; onError?: (error: Error) => void }) => {
          discardOnSuccess = onSuccess;
          discardOnError = onError;
          return {
            mutate: () => {
              mockDiscardMutate();
            },
            isPending: false,
          };
        },
      },
    },
  },
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock offline-queue
vi.mock("~/lib/offline-queue", () => ({
  hasPendingActions: () => false,
}));

// Mock timer-storage
vi.mock("~/lib/timer-storage", () => ({
  hasPersistedTimerState: () => false,
}));

// Mock format
vi.mock("~/lib/format", () => ({
  formatTimer: (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  },
}));

// Import hook after mocks are set up
import { useTimer } from "./use-timer";
import { toast } from "sonner";

describe("useTimer Hook", () => {
  let store: ReturnType<typeof createStore>;

  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(Provider, { store }, children);

  beforeEach(() => {
    store = createStore();
    vi.clearAllMocks();
    // Reset callbacks
    startOnSuccess = undefined;
    startOnError = undefined;
    pauseOnSuccess = undefined;
    pauseOnError = undefined;
    resumeOnSuccess = undefined;
    resumeOnError = undefined;
    stopOnSuccess = undefined;
    stopOnError = undefined;
    discardOnSuccess = undefined;
    discardOnError = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Initial State", () => {
    it("should start with idle state", () => {
      const { result } = renderHook(() => useTimer(), { wrapper });

      expect(result.current.isActive).toBe(false);
      expect(result.current.isRunning).toBe(false);
      expect(result.current.isPaused).toBe(false);
      expect(result.current.displayTime).toBe(0);
      expect(result.current.task).toBeNull();
    });

    it("should expose all action handlers", () => {
      const { result } = renderHook(() => useTimer(), { wrapper });

      expect(typeof result.current.start).toBe("function");
      expect(typeof result.current.pause).toBe("function");
      expect(typeof result.current.resume).toBe("function");
      expect(typeof result.current.stop).toBe("function");
      expect(typeof result.current.discard).toBe("function");
      expect(typeof result.current.switchTask).toBe("function");
    });
  });

  describe("Start Timer", () => {
    it("should start timer optimistically", () => {
      const { result } = renderHook(() => useTimer(), { wrapper });

      act(() => {
        result.current.start(mockTask);
      });

      // Optimistic update should happen immediately
      expect(result.current.isActive).toBe(true);
      expect(result.current.isRunning).toBe(true);
      expect(result.current.task?.id).toBe("task-1");
      expect(mockStartMutate).toHaveBeenCalledWith({ taskId: "task-1" });
    });

    it("should show success toast after mutation succeeds", () => {
      const { result } = renderHook(() => useTimer(), { wrapper });

      act(() => {
        result.current.start(mockTask);
      });

      // Simulate server success
      act(() => {
        startOnSuccess?.({ task: mockTask });
      });

      expect(toast.success).toHaveBeenCalledWith("Timer started", {
        description: expect.stringContaining("Test Task"),
      });
    });

    it("should rollback on error", () => {
      const { result } = renderHook(() => useTimer(), { wrapper });

      act(() => {
        result.current.start(mockTask);
      });

      expect(result.current.isRunning).toBe(true);

      // Simulate server error
      act(() => {
        startOnError?.(new Error("Network error"));
      });

      expect(toast.error).toHaveBeenCalledWith("Failed to start timer", {
        description: "Network error",
      });
      // State should be rolled back to idle
      expect(result.current.isActive).toBe(false);
    });
  });

  describe("Pause Timer", () => {
    it("should pause running timer optimistically", () => {
      const { result } = renderHook(() => useTimer(), { wrapper });

      // Start timer first
      act(() => {
        result.current.start(mockTask);
      });

      act(() => {
        startOnSuccess?.({ task: mockTask });
      });

      // Pause
      act(() => {
        result.current.pause();
      });

      expect(result.current.isPaused).toBe(true);
      expect(result.current.isRunning).toBe(false);
      expect(result.current.isActive).toBe(true);
      expect(mockPauseMutate).toHaveBeenCalled();
    });

    it("should not pause if not running", () => {
      const { result } = renderHook(() => useTimer(), { wrapper });

      act(() => {
        result.current.pause();
      });

      expect(result.current.isActive).toBe(false);
      expect(mockPauseMutate).not.toHaveBeenCalled();
    });

    it("should show info toast after pause succeeds", () => {
      const { result } = renderHook(() => useTimer(), { wrapper });

      act(() => {
        result.current.start(mockTask);
      });

      act(() => {
        startOnSuccess?.({ task: mockTask });
      });

      act(() => {
        result.current.pause();
      });

      act(() => {
        pauseOnSuccess?.();
      });

      expect(toast.info).toHaveBeenCalledWith("Timer paused", {
        description: expect.any(String),
      });
    });

    it("should rollback on pause error", () => {
      const { result } = renderHook(() => useTimer(), { wrapper });

      act(() => {
        result.current.start(mockTask);
      });

      act(() => {
        startOnSuccess?.({ task: mockTask });
      });

      act(() => {
        result.current.pause();
      });

      expect(result.current.isPaused).toBe(true);

      act(() => {
        pauseOnError?.(new Error("Failed to pause"));
      });

      expect(toast.error).toHaveBeenCalledWith("Failed to pause timer", {
        description: "Failed to pause",
      });
      // Should rollback to running
      expect(result.current.isRunning).toBe(true);
    });
  });

  describe("Resume Timer", () => {
    it("should resume paused timer optimistically", () => {
      const { result } = renderHook(() => useTimer(), { wrapper });

      // Start and pause timer
      act(() => {
        result.current.start(mockTask);
      });

      act(() => {
        startOnSuccess?.({ task: mockTask });
      });

      act(() => {
        result.current.pause();
      });

      act(() => {
        pauseOnSuccess?.();
      });

      // Now resume
      act(() => {
        result.current.resume();
      });

      expect(result.current.isRunning).toBe(true);
      expect(result.current.isPaused).toBe(false);
      expect(mockResumeMutate).toHaveBeenCalled();
    });

    it("should not resume if not paused", () => {
      const { result } = renderHook(() => useTimer(), { wrapper });

      // Start timer (it's running, not paused)
      act(() => {
        result.current.start(mockTask);
      });

      act(() => {
        startOnSuccess?.({ task: mockTask });
      });

      // Try to resume while running
      act(() => {
        result.current.resume();
      });

      // Resume mutation should not be called
      expect(mockResumeMutate).not.toHaveBeenCalled();
    });

    it("should rollback on resume error", () => {
      const { result } = renderHook(() => useTimer(), { wrapper });

      act(() => {
        result.current.start(mockTask);
      });

      act(() => {
        startOnSuccess?.({ task: mockTask });
      });

      act(() => {
        result.current.pause();
      });

      act(() => {
        pauseOnSuccess?.();
      });

      act(() => {
        result.current.resume();
      });

      expect(result.current.isRunning).toBe(true);

      act(() => {
        resumeOnError?.(new Error("Failed to resume"));
      });

      expect(toast.error).toHaveBeenCalledWith("Failed to resume timer", {
        description: "Failed to resume",
      });
      expect(result.current.isPaused).toBe(true);
    });
  });

  describe("Stop Timer", () => {
    it("should stop timer and reset to idle", () => {
      const { result } = renderHook(() => useTimer(), { wrapper });

      act(() => {
        result.current.start(mockTask);
      });

      act(() => {
        startOnSuccess?.({ task: mockTask });
      });

      act(() => {
        result.current.stop();
      });

      // Should immediately reset to idle (optimistic)
      expect(result.current.isActive).toBe(false);
      expect(result.current.task).toBeNull();
      expect(mockStopMutate).toHaveBeenCalled();
    });

    it("should invalidate time entry queries on success", () => {
      const { result } = renderHook(() => useTimer(), { wrapper });

      act(() => {
        result.current.start(mockTask);
      });

      act(() => {
        startOnSuccess?.({ task: mockTask });
      });

      act(() => {
        result.current.stop();
      });

      act(() => {
        stopOnSuccess?.({ duration: 60, task: mockTask });
      });

      expect(mockInvalidate).toHaveBeenCalled();
    });

    it("should not stop if already idle", () => {
      const { result } = renderHook(() => useTimer(), { wrapper });

      act(() => {
        result.current.stop();
      });

      expect(mockStopMutate).not.toHaveBeenCalled();
    });

    it("should rollback on stop error", () => {
      const { result } = renderHook(() => useTimer(), { wrapper });

      act(() => {
        result.current.start(mockTask);
      });

      act(() => {
        startOnSuccess?.({ task: mockTask });
      });

      act(() => {
        result.current.stop();
      });

      expect(result.current.isActive).toBe(false);

      act(() => {
        stopOnError?.(new Error("Failed to stop"));
      });

      expect(toast.error).toHaveBeenCalledWith("Failed to stop timer", {
        description: "Failed to stop",
      });
      // Should rollback to running
      expect(result.current.isRunning).toBe(true);
    });
  });

  describe("Discard Timer", () => {
    it("should discard timer and reset to idle", () => {
      const { result } = renderHook(() => useTimer(), { wrapper });

      act(() => {
        result.current.start(mockTask);
      });

      act(() => {
        startOnSuccess?.({ task: mockTask });
      });

      act(() => {
        result.current.discard();
      });

      expect(result.current.isActive).toBe(false);
      expect(mockDiscardMutate).toHaveBeenCalled();
    });

    it("should show warning toast with undo option", () => {
      const { result } = renderHook(() => useTimer(), { wrapper });

      act(() => {
        result.current.start(mockTask);
      });

      act(() => {
        startOnSuccess?.({ task: mockTask });
      });

      act(() => {
        result.current.discard();
      });

      act(() => {
        discardOnSuccess?.({ id: "timer-1" });
      });

      expect(toast.warning).toHaveBeenCalledWith("Timer discarded", {
        description: "Time was not saved",
        duration: 10000,
        action: expect.objectContaining({
          label: "Undo",
        }),
      });
    });

    it("should not discard if already idle", () => {
      const { result } = renderHook(() => useTimer(), { wrapper });

      act(() => {
        result.current.discard();
      });

      expect(mockDiscardMutate).not.toHaveBeenCalled();
    });
  });

  describe("Switch Task", () => {
    it("should start new task when no timer is active", () => {
      const { result } = renderHook(() => useTimer(), { wrapper });

      act(() => {
        result.current.switchTask(mockTask);
      });

      expect(result.current.isActive).toBe(true);
      expect(result.current.task?.id).toBe("task-1");
      expect(mockStartMutate).toHaveBeenCalledWith({ taskId: "task-1" });
    });

    it("should stop current timer when switching", () => {
      const { result } = renderHook(() => useTimer(), { wrapper });

      // Start first task
      act(() => {
        result.current.start(mockTask);
      });

      act(() => {
        startOnSuccess?.({ task: mockTask });
      });

      // Clear mocks
      mockStopMutate.mockClear();
      mockStartMutate.mockClear();

      // Switch to new task
      act(() => {
        result.current.switchTask(mockTask2);
      });

      // Stop should be called for the first task
      expect(mockStopMutate).toHaveBeenCalled();
    });

    it("should start new task only after stop succeeds", () => {
      const { result } = renderHook(() => useTimer(), { wrapper });

      // Start first task
      act(() => {
        result.current.start(mockTask);
      });

      act(() => {
        startOnSuccess?.({ task: mockTask });
      });

      mockStartMutate.mockClear();

      // Switch to new task
      act(() => {
        result.current.switchTask(mockTask2);
      });

      // Start should not be called yet
      expect(mockStartMutate).not.toHaveBeenCalled();

      // Simulate stop success - this triggers start for the new task
      act(() => {
        stopOnSuccess?.({ duration: 60, task: mockTask });
      });

      // After stop success, start should be called for the new task
      expect(mockStartMutate).toHaveBeenCalledWith({ taskId: "task-2" });
    });

    it("should not start new task if stop fails", () => {
      const { result } = renderHook(() => useTimer(), { wrapper });

      // Start first task
      act(() => {
        result.current.start(mockTask);
      });

      act(() => {
        startOnSuccess?.({ task: mockTask });
      });

      mockStartMutate.mockClear();

      // Switch to new task
      act(() => {
        result.current.switchTask(mockTask2);
      });

      // Simulate stop failure
      act(() => {
        stopOnError?.(new Error("Failed to stop"));
      });

      // Start should not be called for new task
      expect(mockStartMutate).not.toHaveBeenCalled();

      // Should show error toast
      expect(toast.error).toHaveBeenCalledWith("Failed to switch tasks", {
        description: "Failed to stop",
      });

      // Timer should be rolled back to original state
      expect(result.current.isRunning).toBe(true);
      expect(result.current.task?.id).toBe("task-1");
    });
  });

  describe("Timer State Properties", () => {
    it("should expose timerState object", () => {
      const { result } = renderHook(() => useTimer(), { wrapper });

      expect(result.current.timerState).toBeDefined();
      expect(result.current.timerState.status).toBe("idle");
    });

    it("should expose isMutating flag", () => {
      const { result } = renderHook(() => useTimer(), { wrapper });

      expect(typeof result.current.isMutating).toBe("boolean");
    });

    it("should expose isPending flag from timer state", () => {
      const { result } = renderHook(() => useTimer(), { wrapper });

      expect(typeof result.current.isPending).toBe("boolean");
    });

    it("should expose pendingAction from timer state", () => {
      const { result } = renderHook(() => useTimer(), { wrapper });

      expect(result.current.pendingAction).toBeNull();

      act(() => {
        result.current.start(mockTask);
      });

      expect(result.current.pendingAction).toBe("start");
    });
  });
});

describe("useTimer Optimistic Updates and Rollback", () => {
  let store: ReturnType<typeof createStore>;

  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(Provider, { store }, children);

  beforeEach(() => {
    store = createStore();
    vi.clearAllMocks();
    startOnSuccess = undefined;
    startOnError = undefined;
    pauseOnSuccess = undefined;
    pauseOnError = undefined;
    resumeOnSuccess = undefined;
    resumeOnError = undefined;
    stopOnSuccess = undefined;
    stopOnError = undefined;
    discardOnSuccess = undefined;
    discardOnError = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should preserve task info through pause/resume cycle", () => {
    const { result } = renderHook(() => useTimer(), { wrapper });

    // Start timer
    act(() => {
      result.current.start(mockTask);
    });

    act(() => {
      startOnSuccess?.({ task: mockTask });
    });

    expect(result.current.task?.id).toBe("task-1");
    expect(result.current.task?.title).toBe("Test Task");

    // Pause
    act(() => {
      result.current.pause();
    });

    act(() => {
      pauseOnSuccess?.();
    });

    expect(result.current.task?.id).toBe("task-1");

    // Resume
    act(() => {
      result.current.resume();
    });

    act(() => {
      resumeOnSuccess?.();
    });

    expect(result.current.task?.id).toBe("task-1");
    expect(result.current.task?.title).toBe("Test Task");
  });

  it("should properly handle multiple rapid actions", () => {
    const { result } = renderHook(() => useTimer(), { wrapper });

    // Start timer
    act(() => {
      result.current.start(mockTask);
    });

    // Confirm start
    act(() => {
      startOnSuccess?.({ task: mockTask });
    });

    // Rapid pause
    act(() => {
      result.current.pause();
    });

    // Timer should now be paused
    expect(result.current.isPaused).toBe(true);
    expect(result.current.isRunning).toBe(false);
    expect(result.current.isActive).toBe(true);
  });

  it("should maintain state consistency after error recovery", () => {
    const { result } = renderHook(() => useTimer(), { wrapper });

    // Start timer
    act(() => {
      result.current.start(mockTask);
    });

    // Fail the start
    act(() => {
      startOnError?.(new Error("Network error"));
    });

    // Should be back to idle
    expect(result.current.isActive).toBe(false);
    expect(result.current.task).toBeNull();

    // Start again
    act(() => {
      result.current.start(mockTask);
    });

    // Succeed this time
    act(() => {
      startOnSuccess?.({ task: mockTask });
    });

    // Should be running with task
    expect(result.current.isRunning).toBe(true);
    expect(result.current.task?.id).toBe("task-1");
  });
});
