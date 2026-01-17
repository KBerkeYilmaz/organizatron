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

describe("projectRouter", () => {
  describe("getAll", () => {
    it("returns all projects with clients", async () => {
      const mockProjects = [
        {
          id: "1",
          clientId: "client-1",
          name: "Project A",
          description: "Description A",
          createdAt: new Date("2024-01-02"),
          updatedAt: new Date("2024-01-02"),
          client: mockClient,
        },
      ];

      prismaMock.project.findMany.mockResolvedValue(mockProjects);

      const caller = createTestCaller();
      const result = await caller.project.getAll();

      expect(result).toEqual(mockProjects);
      expect(prismaMock.project.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: "desc" },
        include: { client: true },
      });
    });
  });

  describe("getByClientId", () => {
    it("returns projects for a specific client", async () => {
      const mockProjects = [
        {
          id: "1",
          clientId: "client-1",
          name: "Project A",
          description: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          client: mockClient,
        },
      ];

      prismaMock.project.findMany.mockResolvedValue(mockProjects);

      const caller = createTestCaller();
      const result = await caller.project.getByClientId({ clientId: "client-1" });

      expect(result).toEqual(mockProjects);
      expect(prismaMock.project.findMany).toHaveBeenCalledWith({
        where: { clientId: "client-1" },
        orderBy: { createdAt: "desc" },
        include: {
          client: true,
          tasks: {
            select: { id: true, status: true },
          },
        },
      });
    });
  });

  describe("getById", () => {
    it("returns project with client and tasks", async () => {
      const mockProject = {
        id: "1",
        clientId: "client-1",
        name: "Test Project",
        description: "Test description",
        createdAt: new Date(),
        updatedAt: new Date(),
        client: mockClient,
        tasks: [
          {
            id: "task-1",
            projectId: "1",
            title: "Task 1",
            description: null,
            status: "todo" as const,
            priority: "medium" as const,
            estimatedTime: null,
            dueDate: null,
            tags: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            completedAt: null,
          },
        ],
      };

      prismaMock.project.findUnique.mockResolvedValue(mockProject);

      const caller = createTestCaller();
      const result = await caller.project.getById({ id: "1" });

      expect(result).toEqual(mockProject);
      expect(prismaMock.project.findUnique).toHaveBeenCalledWith({
        where: { id: "1" },
        include: {
          client: true,
          tasks: { orderBy: { createdAt: "desc" } },
        },
      });
    });

    it("returns null for non-existent project", async () => {
      prismaMock.project.findUnique.mockResolvedValue(null);

      const caller = createTestCaller();
      const result = await caller.project.getById({ id: "non-existent" });

      expect(result).toBeNull();
    });
  });

  describe("create", () => {
    it("creates a project with required fields", async () => {
      const mockProject = {
        id: "new-id",
        clientId: "client-1",
        name: "New Project",
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        client: mockClient,
      };

      prismaMock.project.create.mockResolvedValue(mockProject);

      const caller = createTestCaller();
      const result = await caller.project.create({
        clientId: "client-1",
        name: "New Project",
      });

      expect(result).toEqual(mockProject);
      expect(prismaMock.project.create).toHaveBeenCalledWith({
        data: {
          clientId: "client-1",
          name: "New Project",
          description: undefined,
        },
        include: { client: true },
      });
    });

    it("creates a project with description", async () => {
      const mockProject = {
        id: "new-id",
        clientId: "client-1",
        name: "New Project",
        description: "Project description",
        createdAt: new Date(),
        updatedAt: new Date(),
        client: mockClient,
      };

      prismaMock.project.create.mockResolvedValue(mockProject);

      const caller = createTestCaller();
      const result = await caller.project.create({
        clientId: "client-1",
        name: "New Project",
        description: "Project description",
      });

      expect(result.description).toBe("Project description");
    });

    it("rejects empty name", async () => {
      const caller = createTestCaller();

      await expect(
        caller.project.create({ clientId: "client-1", name: "" })
      ).rejects.toThrow();
    });
  });

  describe("update", () => {
    it("updates project name", async () => {
      const mockProject = {
        id: "1",
        clientId: "client-1",
        name: "Updated Name",
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        client: mockClient,
      };

      prismaMock.project.update.mockResolvedValue(mockProject);

      const caller = createTestCaller();
      const result = await caller.project.update({
        id: "1",
        name: "Updated Name",
      });

      expect(result.name).toBe("Updated Name");
      expect(prismaMock.project.update).toHaveBeenCalledWith({
        where: { id: "1" },
        data: { name: "Updated Name" },
        include: { client: true },
      });
    });
  });

  describe("delete", () => {
    it("deletes a project", async () => {
      const mockProject = {
        id: "1",
        clientId: "client-1",
        name: "To Delete",
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaMock.project.delete.mockResolvedValue(mockProject);

      const caller = createTestCaller();
      const result = await caller.project.delete({ id: "1" });

      expect(result).toEqual(mockProject);
      expect(prismaMock.project.delete).toHaveBeenCalledWith({
        where: { id: "1" },
      });
    });
  });
});
