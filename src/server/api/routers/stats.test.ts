import { describe, expect, it } from "vitest";
import { createTestCaller, prismaMock } from "~/test/trpc-helper";

const mockClient = {
  id: "client-1",
  name: "Test Client",
  color: "#6366f1",
  logo: null,
};

const mockProject = {
  id: "project-1",
  name: "Test Project",
  description: null,
};

describe("statsRouter", () => {
  describe("getClientTimeSummaries", () => {
    it("returns time summaries grouped by client for today", async () => {
      const mockTimeEntries = [
        {
          id: "time-1",
          duration: 3600, // 1 hour
          task: {
            id: "task-1",
            status: "in_progress",
            project: {
              id: "project-1",
              client: mockClient,
            },
          },
        },
        {
          id: "time-2",
          duration: 1800, // 30 min
          task: {
            id: "task-2", // different task
            status: "in_progress",
            project: {
              id: "project-1",
              client: mockClient,
            },
          },
        },
      ];

      prismaMock.timeEntry.findMany.mockResolvedValue(mockTimeEntries as never);

      const caller = createTestCaller();
      const result = await caller.stats.getClientTimeSummaries({
        period: "today",
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        client: {
          id: mockClient.id,
          name: mockClient.name,
          color: mockClient.color,
          logo: mockClient.logo,
        },
        totalTime: 5400, // 1.5 hours
        projectCount: 1,
        taskCount: 2,
      });
    });

    it("returns time summaries for different periods", async () => {
      prismaMock.timeEntry.findMany.mockResolvedValue([]);

      const caller = createTestCaller();
      await caller.stats.getClientTimeSummaries({ period: "week" });

      expect(prismaMock.timeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            startTime: expect.objectContaining({
              gte: expect.any(Date),
              lt: expect.any(Date),
            }),
          }),
        })
      );
    });

    it("returns empty array when no time entries exist", async () => {
      prismaMock.timeEntry.findMany.mockResolvedValue([]);

      const caller = createTestCaller();
      const result = await caller.stats.getClientTimeSummaries({
        period: "today",
      });

      expect(result).toEqual([]);
    });

    it("aggregates multiple clients correctly", async () => {
      const client2 = { ...mockClient, id: "client-2", name: "Client 2" };
      const mockTimeEntries = [
        {
          id: "time-1",
          duration: 3600,
          task: {
            id: "task-1",
            status: "in_progress",
            project: {
              id: "project-1",
              client: mockClient,
            },
          },
        },
        {
          id: "time-2",
          duration: 7200,
          task: {
            id: "task-2",
            status: "in_progress",
            project: {
              id: "project-2",
              client: client2,
            },
          },
        },
      ];

      prismaMock.timeEntry.findMany.mockResolvedValue(mockTimeEntries as never);

      const caller = createTestCaller();
      const result = await caller.stats.getClientTimeSummaries({
        period: "today",
      });

      expect(result).toHaveLength(2);
      // Results are sorted by totalTime descending
      expect(result[0]?.totalTime).toBe(7200);
      expect(result[1]?.totalTime).toBe(3600);
    });
  });

  describe("getTotalTimeForPeriod", () => {
    it("returns total time for today", async () => {
      const mockAggregate = { _sum: { duration: 7200 } };

      prismaMock.timeEntry.aggregate.mockResolvedValue(mockAggregate as never);

      const caller = createTestCaller();
      const result = await caller.stats.getTotalTimeForPeriod({
        period: "today",
      });

      expect(result).toBe(7200);
    });

    it("returns 0 when no time entries", async () => {
      const mockAggregate = { _sum: { duration: null } };

      prismaMock.timeEntry.aggregate.mockResolvedValue(mockAggregate as never);

      const caller = createTestCaller();
      const result = await caller.stats.getTotalTimeForPeriod({
        period: "today",
      });

      expect(result).toBe(0);
    });

    it("returns total time for the week", async () => {
      const mockAggregate = { _sum: { duration: 36000 } };

      prismaMock.timeEntry.aggregate.mockResolvedValue(mockAggregate as never);

      const caller = createTestCaller();
      const result = await caller.stats.getTotalTimeForPeriod({
        period: "week",
      });

      expect(result).toBe(36000);
    });

    it("returns total time for the month", async () => {
      const mockAggregate = { _sum: { duration: 144000 } };

      prismaMock.timeEntry.aggregate.mockResolvedValue(mockAggregate as never);

      const caller = createTestCaller();
      const result = await caller.stats.getTotalTimeForPeriod({
        period: "month",
      });

      expect(result).toBe(144000);
    });
  });

  describe("getProjectTimeSummaries", () => {
    it("returns time summaries grouped by project for a client", async () => {
      const mockTimeEntries = [
        {
          id: "time-1",
          duration: 3600,
          task: {
            id: "task-1",
            status: "in_progress",
            project: mockProject,
          },
        },
        {
          id: "time-2",
          duration: 1800,
          task: {
            id: "task-1", // same task
            status: "in_progress",
            project: mockProject,
          },
        },
      ];

      prismaMock.timeEntry.findMany.mockResolvedValue(mockTimeEntries as never);

      const caller = createTestCaller();
      const result = await caller.stats.getProjectTimeSummaries({
        clientId: "client-1",
        period: "week",
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        project: {
          id: mockProject.id,
          name: mockProject.name,
          description: mockProject.description,
        },
        totalTime: 5400,
        taskCount: 1, // 1 unique task
      });
    });

    it("filters by client correctly", async () => {
      prismaMock.timeEntry.findMany.mockResolvedValue([]);

      const caller = createTestCaller();
      await caller.stats.getProjectTimeSummaries({
        clientId: "client-1",
        period: "today",
      });

      expect(prismaMock.timeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            task: {
              project: {
                clientId: "client-1",
              },
            },
          }),
        })
      );
    });

    it("returns empty array when no projects have time", async () => {
      prismaMock.timeEntry.findMany.mockResolvedValue([]);

      const caller = createTestCaller();
      const result = await caller.stats.getProjectTimeSummaries({
        clientId: "client-1",
        period: "today",
      });

      expect(result).toEqual([]);
    });
  });
});
