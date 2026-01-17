import { describe, expect, it } from "vitest";
import { createTestCaller, prismaMock } from "~/test/trpc-helper";

const mockClient = {
  id: "client-1",
  name: "Test Client",
  color: "#6366f1",
  logo: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

const mockProject = {
  id: "project-1",
  clientId: "client-1",
  name: "Test Project",
  description: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  client: mockClient,
};

describe("taskRouter", () => {

  describe("getAll", () => {
    it("returns all tasks with project and client", async () => {
      const mockTasks = [
        {
          id: "1",
          projectId: "project-1",
          title: "Task 1",
          description: null,
          status: "todo" as const,
          priority: "medium" as const,
          estimatedTime: null,
          dueDate: null,
          tags: [],
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
          completedAt: null,
          project: mockProject,
        },
      ];

      prismaMock.task.findMany.mockResolvedValue(mockTasks);

      const caller = createTestCaller();
      const result = await caller.task.getAll();

      expect(result).toEqual(mockTasks);
      expect(prismaMock.task.findMany).toHaveBeenCalledWith({
        where: {
          projectId: undefined,
          status: undefined,
          priority: undefined,
        },
        orderBy: { createdAt: "desc" },
        include: {
          project: { include: { client: true } },
        },
      });
    });

    it("filters by projectId", async () => {
      prismaMock.task.findMany.mockResolvedValue([]);

      const caller = createTestCaller();
      await caller.task.getAll({ projectId: "project-1" });

      expect(prismaMock.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ projectId: "project-1" }),
        })
      );
    });

    it("filters by status", async () => {
      prismaMock.task.findMany.mockResolvedValue([]);

      const caller = createTestCaller();
      await caller.task.getAll({ status: "in_progress" });

      expect(prismaMock.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: "in_progress" }),
        })
      );
    });

    it("filters by priority", async () => {
      prismaMock.task.findMany.mockResolvedValue([]);

      const caller = createTestCaller();
      await caller.task.getAll({ priority: "urgent" });

      expect(prismaMock.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ priority: "urgent" }),
        })
      );
    });
  });

  describe("getById", () => {
    it("returns task with project, time entries, and active timer", async () => {
      const mockTask = {
        id: "1",
        projectId: "project-1",
        title: "Test Task",
        description: "Description",
        status: "in_progress" as const,
        priority: "high" as const,
        estimatedTime: 3600,
        dueDate: new Date("2024-01-20"),
        tags: ["frontend", "urgent"],
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        completedAt: null,
        project: mockProject,
        timeEntries: [
          {
            id: "te-1",
            taskId: "1",
            startTime: new Date("2024-01-01"),
            endTime: new Date("2024-01-01"),
            duration: 1800,
            notes: null,
            createdAt: new Date("2024-01-01"),
            updatedAt: new Date("2024-01-01"),
          },
        ],
        activeTimer: null,
      };

      prismaMock.task.findUnique.mockResolvedValue(mockTask);

      const caller = createTestCaller();
      const result = await caller.task.getById({ id: "1" });

      expect(result).toEqual(mockTask);
      expect(prismaMock.task.findUnique).toHaveBeenCalledWith({
        where: { id: "1" },
        include: {
          project: { include: { client: true } },
          timeEntries: { orderBy: { startTime: "desc" } },
          activeTimer: true,
        },
      });
    });
  });

  describe("create", () => {
    it("creates a task with required fields", async () => {
      const mockTask = {
        id: "new-id",
        projectId: "project-1",
        title: "New Task",
        description: null,
        status: "todo" as const,
        priority: "medium" as const,
        estimatedTime: null,
        dueDate: null,
        tags: [],
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        completedAt: null,
        project: mockProject,
      };

      prismaMock.task.create.mockResolvedValue(mockTask);

      const caller = createTestCaller();
      const result = await caller.task.create({
        projectId: "project-1",
        title: "New Task",
      });

      expect(result).toEqual(mockTask);
      expect(prismaMock.task.create).toHaveBeenCalledWith({
        data: {
          projectId: "project-1",
          title: "New Task",
          description: undefined,
          status: undefined,
          priority: undefined,
          estimatedTime: undefined,
          dueDate: undefined,
          tags: [],
        },
        include: {
          project: { include: { client: true } },
        },
      });
    });

    it("creates a task with all fields", async () => {
      const dueDate = new Date("2024-01-20");
      const mockTask = {
        id: "new-id",
        projectId: "project-1",
        title: "Full Task",
        description: "Full description",
        status: "in_progress" as const,
        priority: "urgent" as const,
        estimatedTime: 7200,
        dueDate,
        tags: ["frontend", "priority"],
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        completedAt: null,
        project: mockProject,
      };

      prismaMock.task.create.mockResolvedValue(mockTask);

      const caller = createTestCaller();
      const result = await caller.task.create({
        projectId: "project-1",
        title: "Full Task",
        description: "Full description",
        status: "in_progress",
        priority: "urgent",
        estimatedTime: 7200,
        dueDate,
        tags: ["frontend", "priority"],
      });

      expect(result.status).toBe("in_progress");
      expect(result.priority).toBe("urgent");
      expect(result.tags).toEqual(["frontend", "priority"]);
    });

    it("rejects empty title", async () => {
      const caller = createTestCaller();

      await expect(
        caller.task.create({ projectId: "project-1", title: "" })
      ).rejects.toThrow();
    });

    it("rejects invalid status", async () => {
      const caller = createTestCaller();

      await expect(
        caller.task.create({
          projectId: "project-1",
          title: "Test",
          // @ts-expect-error - testing invalid status
          status: "invalid",
        })
      ).rejects.toThrow();
    });
  });

  describe("update", () => {
    it("updates task title", async () => {
      const mockTask = {
        id: "1",
        projectId: "project-1",
        title: "Updated Title",
        description: null,
        status: "todo" as const,
        priority: "medium" as const,
        estimatedTime: null,
        dueDate: null,
        tags: [],
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        completedAt: null,
        project: mockProject,
      };

      prismaMock.task.update.mockResolvedValue(mockTask);

      const caller = createTestCaller();
      const result = await caller.task.update({
        id: "1",
        title: "Updated Title",
      });

      expect(result.title).toBe("Updated Title");
    });

    it("sets completedAt when status changes to completed", async () => {
      const mockTask = {
        id: "1",
        projectId: "project-1",
        title: "Task",
        description: null,
        status: "completed" as const,
        priority: "medium" as const,
        estimatedTime: null,
        dueDate: null,
        tags: [],
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        completedAt: new Date("2024-01-15T10:00:00Z"),
        project: mockProject,
      };

      prismaMock.task.update.mockResolvedValue(mockTask);

      const caller = createTestCaller();
      await caller.task.update({ id: "1", status: "completed" });

      expect(prismaMock.task.update).toHaveBeenCalledWith({
        where: { id: "1" },
        data: {
          status: "completed",
          completedAt: expect.any(Date),
        },
        include: {
          project: { include: { client: true } },
        },
      });
    });

    it("clears completedAt when status changes from completed", async () => {
      const mockTask = {
        id: "1",
        projectId: "project-1",
        title: "Task",
        description: null,
        status: "in_progress" as const,
        priority: "medium" as const,
        estimatedTime: null,
        dueDate: null,
        tags: [],
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        completedAt: null,
        project: mockProject,
      };

      prismaMock.task.update.mockResolvedValue(mockTask);

      const caller = createTestCaller();
      await caller.task.update({ id: "1", status: "in_progress" });

      expect(prismaMock.task.update).toHaveBeenCalledWith({
        where: { id: "1" },
        data: {
          status: "in_progress",
          completedAt: null,
        },
        include: {
          project: { include: { client: true } },
        },
      });
    });
  });

  describe("delete", () => {
    it("deletes a task", async () => {
      const mockTask = {
        id: "1",
        projectId: "project-1",
        title: "To Delete",
        description: null,
        status: "todo" as const,
        priority: "medium" as const,
        estimatedTime: null,
        dueDate: null,
        tags: [],
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        completedAt: null,
      };

      prismaMock.task.delete.mockResolvedValue(mockTask);

      const caller = createTestCaller();
      const result = await caller.task.delete({ id: "1" });

      expect(result).toEqual(mockTask);
    });
  });

  describe("updateStatus", () => {
    it("bulk updates task statuses", async () => {
      prismaMock.task.updateMany.mockResolvedValue({ count: 3 });

      const caller = createTestCaller();
      const result = await caller.task.updateStatus({
        ids: ["1", "2", "3"],
        status: "completed",
      });

      expect(result.count).toBe(3);
      expect(prismaMock.task.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["1", "2", "3"] } },
        data: {
          status: "completed",
          completedAt: expect.any(Date),
        },
      });
    });

    it("clears completedAt when bulk updating to non-completed status", async () => {
      prismaMock.task.updateMany.mockResolvedValue({ count: 2 });

      const caller = createTestCaller();
      await caller.task.updateStatus({
        ids: ["1", "2"],
        status: "todo",
      });

      expect(prismaMock.task.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["1", "2"] } },
        data: {
          status: "todo",
          completedAt: null,
        },
      });
    });
  });
});
