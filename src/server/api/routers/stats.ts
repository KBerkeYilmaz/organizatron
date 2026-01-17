import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

const timePeriodEnum = z.enum(["today", "week", "month"]);

// Helper to get date range for a period
function getDateRange(period: "today" | "week" | "month"): {
  start: Date;
  end: Date;
} {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  if (period === "today") {
    return { start, end };
  }

  if (period === "week") {
    const dayOfWeek = start.getDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday = 0
    start.setDate(start.getDate() - diff);
    end.setDate(start.getDate() + 7);
    return { start, end };
  }

  if (period === "month") {
    start.setDate(1);
    end.setMonth(end.getMonth() + 1);
    end.setDate(1);
    return { start, end };
  }

  return { start, end };
}

export const statsRouter = createTRPCRouter({
  // Get time summaries grouped by client
  getClientTimeSummaries: publicProcedure
    .input(z.object({ period: timePeriodEnum }))
    .query(async ({ ctx, input }) => {
      const { start, end } = getDateRange(input.period);

      // Get all time entries in the period with task/project/client info
      const timeEntries = await ctx.db.timeEntry.findMany({
        where: {
          startTime: {
            gte: start,
            lt: end,
          },
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

      // Aggregate by client
      const clientMap = new Map<
        string,
        {
          client: { id: string; name: string; color: string; logo: string | null };
          totalTime: number;
          projects: Set<string>;
          tasks: Set<string>;
        }
      >();

      for (const entry of timeEntries) {
        const client = entry.task.project.client;
        const existing = clientMap.get(client.id);

        if (existing) {
          existing.totalTime += entry.duration;
          existing.projects.add(entry.task.project.id);
          existing.tasks.add(entry.task.id);
        } else {
          clientMap.set(client.id, {
            client: {
              id: client.id,
              name: client.name,
              color: client.color,
              logo: client.logo,
            },
            totalTime: entry.duration,
            projects: new Set([entry.task.project.id]),
            tasks: new Set([entry.task.id]),
          });
        }
      }

      // Convert to array and sort by total time
      return Array.from(clientMap.values())
        .map((item) => ({
          client: item.client,
          totalTime: item.totalTime,
          projectCount: item.projects.size,
          taskCount: item.tasks.size,
        }))
        .sort((a, b) => b.totalTime - a.totalTime);
    }),

  // Get total time for a period
  getTotalTimeForPeriod: publicProcedure
    .input(z.object({ period: timePeriodEnum }))
    .query(async ({ ctx, input }) => {
      const { start, end } = getDateRange(input.period);

      const result = await ctx.db.timeEntry.aggregate({
        where: {
          startTime: {
            gte: start,
            lt: end,
          },
        },
        _sum: {
          duration: true,
        },
      });

      return result._sum.duration ?? 0;
    }),

  // Get project time summaries for a client
  getProjectTimeSummaries: publicProcedure
    .input(
      z.object({
        clientId: z.string(),
        period: timePeriodEnum,
      })
    )
    .query(async ({ ctx, input }) => {
      const { start, end } = getDateRange(input.period);

      // Get all time entries for projects belonging to this client
      const timeEntries = await ctx.db.timeEntry.findMany({
        where: {
          startTime: {
            gte: start,
            lt: end,
          },
          task: {
            project: {
              clientId: input.clientId,
            },
          },
        },
        include: {
          task: {
            include: {
              project: true,
            },
          },
        },
      });

      // Aggregate by project
      const projectMap = new Map<
        string,
        {
          project: { id: string; name: string; description: string | null };
          totalTime: number;
          tasks: Set<string>;
          completedTasks: Set<string>;
        }
      >();

      for (const entry of timeEntries) {
        const project = entry.task.project;
        const existing = projectMap.get(project.id);

        if (existing) {
          existing.totalTime += entry.duration;
          existing.tasks.add(entry.task.id);
          if (entry.task.status === "completed") {
            existing.completedTasks.add(entry.task.id);
          }
        } else {
          projectMap.set(project.id, {
            project: {
              id: project.id,
              name: project.name,
              description: project.description,
            },
            totalTime: entry.duration,
            tasks: new Set([entry.task.id]),
            completedTasks:
              entry.task.status === "completed"
                ? new Set([entry.task.id])
                : new Set(),
          });
        }
      }

      // Convert to array and sort by total time
      return Array.from(projectMap.values())
        .map((item) => ({
          project: item.project,
          totalTime: item.totalTime,
          taskCount: item.tasks.size,
          completedTaskCount: item.completedTasks.size,
        }))
        .sort((a, b) => b.totalTime - a.totalTime);
    }),
});
