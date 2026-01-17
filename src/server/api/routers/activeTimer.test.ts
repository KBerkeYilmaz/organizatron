import { describe, expect, it } from "vitest";
import { createTestCaller, prismaMock } from "~/test/trpc-helper";

const mockClient = {
  id: "client-1",
  name: "Test Client",
  color: "#6366f1",
  logo: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockProject = {
  id: "project-1",
  clientId: "client-1",
  name: "Test Project",
  description: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  client: mockClient,
};

const mockTask = {
  id: "task-1",
  projectId: "project-1",
  title: "Test Task",
  description: null,
  status: "in_progress" as const,
  priority: "medium" as const,
  estimatedTime: null,
  dueDate: null,
  tags: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  completedAt: null,
  project: mockProject,
};

const mockActiveTimer = {
  id: "timer-1",
  taskId: "task-1",
  startTime: new Date("2024-01-15T09:00:00Z"),
  elapsed: 0,
  isPaused: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  task: mockTask,
};

describe("activeTimerRouter", () => {
  describe("getCurrent", () => {
    it("returns the active timer with task details", async () => {
      prismaMock.activeTimer.findFirst.mockResolvedValue(mockActiveTimer);

      const caller = createTestCaller();
      const result = await caller.activeTimer.getCurrent();

      expect(result).toEqual(mockActiveTimer);
      expect(prismaMock.activeTimer.findFirst).toHaveBeenCalledWith({
        include: {
          task: {
            include: {
              project: {
                include: { client: true },
              },
            },
          },
        },
      });
    });

    it("returns null when no active timer exists", async () => {
      prismaMock.activeTimer.findFirst.mockResolvedValue(null);

      const caller = createTestCaller();
      const result = await caller.activeTimer.getCurrent();

      expect(result).toBeNull();
    });
  });

  describe("start", () => {
    it("starts a timer for a task", async () => {
      prismaMock.activeTimer.findFirst.mockResolvedValue(null);
      prismaMock.task.findUnique.mockResolvedValue(mockTask);
      prismaMock.activeTimer.create.mockResolvedValue(mockActiveTimer);

      const caller = createTestCaller();
      const result = await caller.activeTimer.start({ taskId: "task-1" });

      expect(result).toEqual(mockActiveTimer);
      expect(prismaMock.activeTimer.create).toHaveBeenCalledWith({
        data: {
          taskId: "task-1",
          startTime: expect.any(Date),
          elapsed: 0,
        },
        include: expect.any(Object),
      });
    });

    it("throws error when timer already running", async () => {
      prismaMock.activeTimer.findFirst.mockResolvedValue(mockActiveTimer);

      const caller = createTestCaller();

      await expect(
        caller.activeTimer.start({ taskId: "task-2" })
      ).rejects.toThrow("A timer is already running");
    });

    it("throws error when task not found", async () => {
      prismaMock.activeTimer.findFirst.mockResolvedValue(null);
      prismaMock.task.findUnique.mockResolvedValue(null);

      const caller = createTestCaller();

      await expect(
        caller.activeTimer.start({ taskId: "non-existent" })
      ).rejects.toThrow("Task not found");
    });
  });

  describe("pause", () => {
    it("pauses the current timer and updates elapsed time", async () => {
      const runningTimer = {
        ...mockActiveTimer,
        startTime: new Date(Date.now() - 3600000), // 1 hour ago
        elapsed: 1800, // 30 min already elapsed
        isPaused: false,
      };

      prismaMock.activeTimer.findFirst.mockResolvedValue(runningTimer);
      prismaMock.activeTimer.update.mockResolvedValue({
        ...runningTimer,
        elapsed: expect.any(Number),
        isPaused: true,
      });

      const caller = createTestCaller();
      await caller.activeTimer.pause();

      expect(prismaMock.activeTimer.update).toHaveBeenCalledWith({
        where: { id: "timer-1" },
        data: {
          elapsed: expect.any(Number),
          isPaused: true,
        },
        include: expect.any(Object),
      });
    });

    it("throws error when no timer to pause", async () => {
      prismaMock.activeTimer.findFirst.mockResolvedValue(null);

      const caller = createTestCaller();

      await expect(caller.activeTimer.pause()).rejects.toThrow(
        "No active timer to pause"
      );
    });

    it("throws error when timer is already paused", async () => {
      const pausedTimer = {
        ...mockActiveTimer,
        isPaused: true,
        elapsed: 1800,
      };

      prismaMock.activeTimer.findFirst.mockResolvedValue(pausedTimer);

      const caller = createTestCaller();

      await expect(caller.activeTimer.pause()).rejects.toThrow(
        "Timer is already paused"
      );
    });
  });

  describe("resume", () => {
    it("resumes a paused timer", async () => {
      const pausedTimer = {
        ...mockActiveTimer,
        elapsed: 1800,
        isPaused: true,
      };

      prismaMock.activeTimer.findFirst.mockResolvedValue(pausedTimer);
      prismaMock.activeTimer.update.mockResolvedValue({
        ...pausedTimer,
        startTime: new Date(),
        isPaused: false,
      });

      const caller = createTestCaller();
      await caller.activeTimer.resume();

      expect(prismaMock.activeTimer.update).toHaveBeenCalledWith({
        where: { id: "timer-1" },
        data: {
          startTime: expect.any(Date),
          isPaused: false,
        },
        include: expect.any(Object),
      });
    });

    it("throws error when no timer to resume", async () => {
      prismaMock.activeTimer.findFirst.mockResolvedValue(null);

      const caller = createTestCaller();

      await expect(caller.activeTimer.resume()).rejects.toThrow(
        "No timer to resume"
      );
    });

    it("throws error when timer is not paused", async () => {
      const runningTimer = {
        ...mockActiveTimer,
        isPaused: false,
      };

      prismaMock.activeTimer.findFirst.mockResolvedValue(runningTimer);

      const caller = createTestCaller();

      await expect(caller.activeTimer.resume()).rejects.toThrow(
        "Timer is not paused"
      );
    });
  });

  describe("stop", () => {
    it("stops a running timer and creates a time entry", async () => {
      const runningTimer = {
        ...mockActiveTimer,
        startTime: new Date(Date.now() - 3600000), // 1 hour ago
        elapsed: 1800,
        isPaused: false,
      };

      const mockTimeEntry = {
        id: "time-1",
        taskId: "task-1",
        startTime: new Date(),
        endTime: new Date(),
        duration: 5400, // 1.5 hours
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        task: mockTask,
      };

      prismaMock.activeTimer.findFirst.mockResolvedValue(runningTimer);
      prismaMock.timeEntry.create.mockResolvedValue(mockTimeEntry);
      prismaMock.activeTimer.delete.mockResolvedValue(runningTimer);

      const caller = createTestCaller();
      const result = await caller.activeTimer.stop();

      expect(result).toEqual(mockTimeEntry);
      expect(prismaMock.timeEntry.create).toHaveBeenCalled();
      expect(prismaMock.activeTimer.delete).toHaveBeenCalledWith({
        where: { id: "timer-1" },
      });
    });

    it("stops a paused timer and creates a time entry with correct duration", async () => {
      const pausedTimer = {
        ...mockActiveTimer,
        elapsed: 1800, // 30 minutes accumulated
        isPaused: true,
      };

      const mockTimeEntry = {
        id: "time-1",
        taskId: "task-1",
        startTime: new Date(),
        endTime: new Date(),
        duration: 1800,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        task: mockTask,
      };

      prismaMock.activeTimer.findFirst.mockResolvedValue(pausedTimer);
      prismaMock.timeEntry.create.mockResolvedValue(mockTimeEntry);
      prismaMock.activeTimer.delete.mockResolvedValue(pausedTimer);

      const caller = createTestCaller();
      const result = await caller.activeTimer.stop();

      expect(result).toEqual(mockTimeEntry);
      // When paused, duration should use elapsed only (no additional time calculation)
      expect(prismaMock.timeEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            duration: 1800,
          }),
        })
      );
    });

    it("throws error when no timer to stop", async () => {
      prismaMock.activeTimer.findFirst.mockResolvedValue(null);

      const caller = createTestCaller();

      await expect(caller.activeTimer.stop()).rejects.toThrow(
        "No active timer to stop"
      );
    });
  });

  describe("discard", () => {
    it("discards the timer without creating a time entry", async () => {
      prismaMock.activeTimer.findFirst.mockResolvedValue(mockActiveTimer);
      prismaMock.activeTimer.delete.mockResolvedValue(mockActiveTimer);

      const caller = createTestCaller();
      const result = await caller.activeTimer.discard();

      expect(result).toEqual(mockActiveTimer);
      expect(prismaMock.activeTimer.delete).toHaveBeenCalledWith({
        where: { id: "timer-1" },
      });
      expect(prismaMock.timeEntry.create).not.toHaveBeenCalled();
    });

    it("throws error when no timer to discard", async () => {
      prismaMock.activeTimer.findFirst.mockResolvedValue(null);

      const caller = createTestCaller();

      await expect(caller.activeTimer.discard()).rejects.toThrow(
        "No active timer to discard"
      );
    });
  });
});
