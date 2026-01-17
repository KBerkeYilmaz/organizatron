import { describe, expect, it } from "vitest";
import { createTestCaller, prismaMock } from "~/test/trpc-helper";

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
};

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

const mockTimeEntry = {
  id: "time-1",
  taskId: "task-1",
  startTime: new Date("2024-01-15T09:00:00Z"),
  endTime: new Date("2024-01-15T11:00:00Z"),
  duration: 7200, // 2 hours in seconds
  notes: "Worked on feature",
  createdAt: new Date(),
  updatedAt: new Date(),
  task: {
    ...mockTask,
    project: mockProject,
  },
};

describe("timeEntryRouter", () => {
  describe("getAll", () => {
    it("returns all time entries with task, project, and client", async () => {
      const mockEntries = [mockTimeEntry];

      prismaMock.timeEntry.findMany.mockResolvedValue(mockEntries);

      const caller = createTestCaller();
      const result = await caller.timeEntry.getAll();

      expect(result).toEqual(mockEntries);
      expect(prismaMock.timeEntry.findMany).toHaveBeenCalledWith({
        where: {
          taskId: undefined,
          startTime: {
            gte: undefined,
            lte: undefined,
          },
        },
        orderBy: { startTime: "desc" },
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

    it("filters by taskId", async () => {
      prismaMock.timeEntry.findMany.mockResolvedValue([mockTimeEntry]);

      const caller = createTestCaller();
      await caller.timeEntry.getAll({ taskId: "task-1" });

      expect(prismaMock.timeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            taskId: "task-1",
          }),
        })
      );
    });

    it("filters by date range", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");

      prismaMock.timeEntry.findMany.mockResolvedValue([]);

      const caller = createTestCaller();
      await caller.timeEntry.getAll({ startDate, endDate });

      expect(prismaMock.timeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            startTime: {
              gte: startDate,
              lte: endDate,
            },
          }),
        })
      );
    });
  });

  describe("getRecent", () => {
    it("returns limited recent entries", async () => {
      prismaMock.timeEntry.findMany.mockResolvedValue([mockTimeEntry]);

      const caller = createTestCaller();
      const result = await caller.timeEntry.getRecent({ limit: 5 });

      expect(result).toEqual([mockTimeEntry]);
      expect(prismaMock.timeEntry.findMany).toHaveBeenCalledWith({
        take: 5,
        orderBy: { startTime: "desc" },
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

    it("uses default limit of 10", async () => {
      prismaMock.timeEntry.findMany.mockResolvedValue([]);

      const caller = createTestCaller();
      await caller.timeEntry.getRecent({});

      expect(prismaMock.timeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        })
      );
    });
  });

  describe("getByTaskId", () => {
    it("returns entries for a specific task", async () => {
      const entries = [
        { ...mockTimeEntry, task: undefined },
      ];

      prismaMock.timeEntry.findMany.mockResolvedValue(entries);

      const caller = createTestCaller();
      const result = await caller.timeEntry.getByTaskId({ taskId: "task-1" });

      expect(result).toEqual(entries);
      expect(prismaMock.timeEntry.findMany).toHaveBeenCalledWith({
        where: { taskId: "task-1" },
        orderBy: { startTime: "desc" },
      });
    });
  });

  describe("create", () => {
    it("creates a time entry with required fields", async () => {
      const newEntry = {
        ...mockTimeEntry,
        notes: null,
      };

      prismaMock.timeEntry.create.mockResolvedValue(newEntry);

      const caller = createTestCaller();
      const result = await caller.timeEntry.create({
        taskId: "task-1",
        startTime: new Date("2024-01-15T09:00:00Z"),
        duration: 7200,
      });

      expect(result).toEqual(newEntry);
      expect(prismaMock.timeEntry.create).toHaveBeenCalledWith({
        data: {
          taskId: "task-1",
          startTime: expect.any(Date),
          endTime: undefined,
          duration: 7200,
          notes: undefined,
        },
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

    it("creates a time entry with all fields", async () => {
      prismaMock.timeEntry.create.mockResolvedValue(mockTimeEntry);

      const caller = createTestCaller();
      await caller.timeEntry.create({
        taskId: "task-1",
        startTime: new Date("2024-01-15T09:00:00Z"),
        endTime: new Date("2024-01-15T11:00:00Z"),
        duration: 7200,
        notes: "Worked on feature",
      });

      expect(prismaMock.timeEntry.create).toHaveBeenCalledWith({
        data: {
          taskId: "task-1",
          startTime: expect.any(Date),
          endTime: expect.any(Date),
          duration: 7200,
          notes: "Worked on feature",
        },
        include: expect.any(Object),
      });
    });

    it("rejects negative duration", async () => {
      const caller = createTestCaller();

      await expect(
        caller.timeEntry.create({
          taskId: "task-1",
          startTime: new Date(),
          duration: -100,
        })
      ).rejects.toThrow();
    });
  });

  describe("update", () => {
    it("updates time entry duration", async () => {
      const updatedEntry = { ...mockTimeEntry, duration: 10800 };

      prismaMock.timeEntry.update.mockResolvedValue(updatedEntry);

      const caller = createTestCaller();
      const result = await caller.timeEntry.update({
        id: "time-1",
        duration: 10800,
      });

      expect(result.duration).toBe(10800);
      expect(prismaMock.timeEntry.update).toHaveBeenCalledWith({
        where: { id: "time-1" },
        data: { duration: 10800 },
        include: expect.any(Object),
      });
    });

    it("updates time entry notes", async () => {
      const updatedEntry = { ...mockTimeEntry, notes: "Updated notes" };

      prismaMock.timeEntry.update.mockResolvedValue(updatedEntry);

      const caller = createTestCaller();
      await caller.timeEntry.update({
        id: "time-1",
        notes: "Updated notes",
      });

      expect(prismaMock.timeEntry.update).toHaveBeenCalledWith({
        where: { id: "time-1" },
        data: { notes: "Updated notes" },
        include: expect.any(Object),
      });
    });
  });

  describe("delete", () => {
    it("deletes a time entry", async () => {
      prismaMock.timeEntry.delete.mockResolvedValue(mockTimeEntry);

      const caller = createTestCaller();
      const result = await caller.timeEntry.delete({ id: "time-1" });

      expect(result).toEqual(mockTimeEntry);
      expect(prismaMock.timeEntry.delete).toHaveBeenCalledWith({
        where: { id: "time-1" },
      });
    });
  });
});
