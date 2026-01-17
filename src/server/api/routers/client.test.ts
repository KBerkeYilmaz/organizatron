import { describe, expect, it } from "vitest";
import { createTestCaller, prismaMock } from "~/test/trpc-helper";

describe("clientRouter", () => {
  describe("getAll", () => {
    it("returns all clients ordered by createdAt desc", async () => {
      const mockClients = [
        {
          id: "1",
          name: "Client A",
          color: "#6366f1",
          logo: null,
          createdAt: new Date("2024-01-02"),
          updatedAt: new Date("2024-01-02"),
        },
        {
          id: "2",
          name: "Client B",
          color: "#22c55e",
          logo: null,
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
        },
      ];

      prismaMock.client.findMany.mockResolvedValue(mockClients);

      const caller = createTestCaller();
      const result = await caller.client.getAll();

      expect(result).toEqual(mockClients);
      expect(prismaMock.client.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: "desc" },
      });
    });

    it("returns empty array when no clients exist", async () => {
      prismaMock.client.findMany.mockResolvedValue([]);

      const caller = createTestCaller();
      const result = await caller.client.getAll();

      expect(result).toEqual([]);
    });
  });

  describe("getById", () => {
    it("returns client with projects", async () => {
      const mockClient = {
        id: "1",
        name: "Test Client",
        color: "#6366f1",
        logo: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        projects: [
          {
            id: "p1",
            clientId: "1",
            name: "Project 1",
            description: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      prismaMock.client.findUnique.mockResolvedValue(mockClient);

      const caller = createTestCaller();
      const result = await caller.client.getById({ id: "1" });

      expect(result).toEqual(mockClient);
      expect(prismaMock.client.findUnique).toHaveBeenCalledWith({
        where: { id: "1" },
        include: { projects: true },
      });
    });

    it("returns null for non-existent client", async () => {
      prismaMock.client.findUnique.mockResolvedValue(null);

      const caller = createTestCaller();
      const result = await caller.client.getById({ id: "non-existent" });

      expect(result).toBeNull();
    });
  });

  describe("create", () => {
    it("creates a client with required fields", async () => {
      const mockClient = {
        id: "new-id",
        name: "New Client",
        color: "#6366f1",
        logo: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaMock.client.create.mockResolvedValue(mockClient);

      const caller = createTestCaller();
      const result = await caller.client.create({ name: "New Client" });

      expect(result).toEqual(mockClient);
      expect(prismaMock.client.create).toHaveBeenCalledWith({
        data: {
          name: "New Client",
          color: undefined,
          logo: undefined,
        },
      });
    });

    it("creates a client with all fields", async () => {
      const mockClient = {
        id: "new-id",
        name: "New Client",
        color: "#ff0000",
        logo: "https://example.com/logo.png",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaMock.client.create.mockResolvedValue(mockClient);

      const caller = createTestCaller();
      const result = await caller.client.create({
        name: "New Client",
        color: "#ff0000",
        logo: "https://example.com/logo.png",
      });

      expect(result.color).toBe("#ff0000");
      expect(result.logo).toBe("https://example.com/logo.png");
    });

    it("rejects empty name", async () => {
      const caller = createTestCaller();

      await expect(caller.client.create({ name: "" })).rejects.toThrow();
    });

    it("rejects invalid color format", async () => {
      const caller = createTestCaller();

      await expect(
        caller.client.create({ name: "Test", color: "red" })
      ).rejects.toThrow();
    });

    it("rejects invalid logo URL", async () => {
      const caller = createTestCaller();

      await expect(
        caller.client.create({ name: "Test", logo: "not-a-url" })
      ).rejects.toThrow();
    });
  });

  describe("update", () => {
    it("updates client name", async () => {
      const mockClient = {
        id: "1",
        name: "Updated Name",
        color: "#6366f1",
        logo: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaMock.client.update.mockResolvedValue(mockClient);

      const caller = createTestCaller();
      const result = await caller.client.update({
        id: "1",
        name: "Updated Name",
      });

      expect(result.name).toBe("Updated Name");
      expect(prismaMock.client.update).toHaveBeenCalledWith({
        where: { id: "1" },
        data: { name: "Updated Name" },
      });
    });

    it("updates multiple fields", async () => {
      const mockClient = {
        id: "1",
        name: "Updated",
        color: "#00ff00",
        logo: "https://example.com/new-logo.png",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaMock.client.update.mockResolvedValue(mockClient);

      const caller = createTestCaller();
      await caller.client.update({
        id: "1",
        name: "Updated",
        color: "#00ff00",
        logo: "https://example.com/new-logo.png",
      });

      expect(prismaMock.client.update).toHaveBeenCalledWith({
        where: { id: "1" },
        data: {
          name: "Updated",
          color: "#00ff00",
          logo: "https://example.com/new-logo.png",
        },
      });
    });
  });

  describe("delete", () => {
    it("deletes a client", async () => {
      const mockClient = {
        id: "1",
        name: "To Delete",
        color: "#6366f1",
        logo: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaMock.client.delete.mockResolvedValue(mockClient);

      const caller = createTestCaller();
      const result = await caller.client.delete({ id: "1" });

      expect(result).toEqual(mockClient);
      expect(prismaMock.client.delete).toHaveBeenCalledWith({
        where: { id: "1" },
      });
    });
  });
});
