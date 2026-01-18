import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

const periodEnum = z.enum(["today", "week", "month", "custom"]);

// Helper to get date range for a period (Sunday-based weeks)
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
    const dayOfWeek = start.getDay(); // Sunday = 0
    start.setDate(start.getDate() - dayOfWeek); // Go back to Sunday
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

// Helper to get the start of week (Sunday) for a date
function getWeekStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayOfWeek = d.getDay();
  d.setDate(d.getDate() - dayOfWeek);
  return d;
}

// Helper to get the end of week (Saturday) for a date
function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return end;
}

// Helper to get date key for grouping
function getDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Helper to get week key for grouping
function getWeekKey(date: Date): string {
  const weekStart = getWeekStart(date);
  return getDateKey(weekStart);
}

export const timeEntryRouter = createTRPCRouter({
  getAll: publicProcedure
    .input(
      z
        .object({
          taskId: z.string().optional(),
          startDate: z.date().optional(),
          endDate: z.date().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.timeEntry.findMany({
        where: {
          taskId: input?.taskId,
          startTime: {
            gte: input?.startDate,
            lte: input?.endDate,
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
    }),

  getRecent: publicProcedure
    .input(z.object({ limit: z.number().int().positive().default(10) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.timeEntry.findMany({
        take: input.limit,
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
    }),

  // Get recent entries grouped by task with all working periods
  getRecentGroupedByTask: publicProcedure
    .input(
      z.object({
        limit: z.number().int().positive().default(10),
        days: z.number().int().positive().default(7),
      })
    )
    .query(async ({ ctx, input }) => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);
      startDate.setHours(0, 0, 0, 0);

      const entries = await ctx.db.timeEntry.findMany({
        where: {
          startTime: { gte: startDate },
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

      // Group by task
      const grouped = entries.reduce(
        (acc, entry) => {
          const taskId = entry.taskId;
          if (!acc[taskId]) {
            acc[taskId] = {
              task: entry.task,
              entries: [],
              totalDuration: 0,
            };
          }
          acc[taskId]!.entries.push(entry);
          acc[taskId]!.totalDuration += entry.duration;
          return acc;
        },
        {} as Record<
          string,
          {
            task: typeof entries[0]["task"];
            entries: typeof entries;
            totalDuration: number;
          }
        >
      );

      // Convert to array and sort by total duration
      return Object.values(grouped)
        .sort((a, b) => b.totalDuration - a.totalDuration)
        .slice(0, input.limit);
    }),

  // Get filtered entries with period and entity filters, grouped by task and time period
  getFiltered: publicProcedure
    .input(
      z.object({
        period: periodEnum,
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        taskId: z.string().nullish(),
        projectId: z.string().nullish(),
        clientId: z.string().nullish(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Determine date range based on period
      let start: Date;
      let end: Date;

      if (input.period === "custom") {
        if (!input.startDate || !input.endDate) {
          throw new Error("Custom period requires startDate and endDate");
        }
        start = input.startDate;
        end = input.endDate;
        // Set end to end of day
        end.setHours(23, 59, 59, 999);
      } else {
        const range = getDateRange(input.period);
        start = range.start;
        end = range.end;
      }

      // Build where clause with optional filters
      const entries = await ctx.db.timeEntry.findMany({
        where: {
          startTime: {
            gte: start,
            lt: end,
          },
          ...(input.taskId && { taskId: input.taskId }),
          ...(input.projectId && {
            task: { projectId: input.projectId },
          }),
          ...(input.clientId && {
            task: {
              project: { clientId: input.clientId },
            },
          }),
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

      // Group by task (flat grouping)
      const groupedByTask = entries.reduce(
        (acc, entry) => {
          const taskId = entry.taskId;
          if (!acc[taskId]) {
            acc[taskId] = {
              task: entry.task,
              entries: [],
              totalDuration: 0,
            };
          }
          acc[taskId]!.entries.push(entry);
          acc[taskId]!.totalDuration += entry.duration;
          return acc;
        },
        {} as Record<
          string,
          {
            task: (typeof entries)[0]["task"];
            entries: typeof entries;
            totalDuration: number;
          }
        >
      );

      // Determine grouping strategy based on period
      // - today: no time grouping needed (flat)
      // - week: group by day
      // - month: group by week
      // - custom: determine based on range length
      type TimeGrouping = "none" | "day" | "week";
      let timeGrouping: TimeGrouping = "none";

      if (input.period === "week") {
        timeGrouping = "day";
      } else if (input.period === "month") {
        timeGrouping = "week";
      } else if (input.period === "custom" && input.startDate && input.endDate) {
        const daysDiff = Math.ceil(
          (input.endDate.getTime() - input.startDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysDiff > 14) {
          timeGrouping = "week";
        } else if (daysDiff > 1) {
          timeGrouping = "day";
        }
      }

      // Group entries by time period
      type TimePeriodGroup = {
        key: string;
        label: string;
        startDate: Date;
        endDate: Date;
        entries: typeof entries;
        totalDuration: number;
      };

      const timePeriodGroups: TimePeriodGroup[] = [];

      if (timeGrouping !== "none") {
        const periodMap = new Map<string, TimePeriodGroup>();

        for (const entry of entries) {
          const entryDate = new Date(entry.startTime);
          let key: string;
          let periodStart: Date;
          let periodEnd: Date;
          let label: string;

          if (timeGrouping === "day") {
            key = getDateKey(entryDate);
            periodStart = new Date(entryDate.getFullYear(), entryDate.getMonth(), entryDate.getDate());
            periodEnd = new Date(periodStart);
            periodEnd.setDate(periodEnd.getDate() + 1);
            label = entryDate.toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
            });
          } else {
            // week grouping
            key = getWeekKey(entryDate);
            periodStart = getWeekStart(entryDate);
            periodEnd = getWeekEnd(entryDate);
            const weekEndLabel = periodEnd.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });
            const weekStartLabel = periodStart.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });
            label = `${weekStartLabel} - ${weekEndLabel}`;
          }

          if (!periodMap.has(key)) {
            periodMap.set(key, {
              key,
              label,
              startDate: periodStart,
              endDate: periodEnd,
              entries: [],
              totalDuration: 0,
            });
          }

          const group = periodMap.get(key)!;
          group.entries.push(entry);
          group.totalDuration += entry.duration;
        }

        // Sort by date descending (most recent first)
        timePeriodGroups.push(
          ...Array.from(periodMap.values()).sort(
            (a, b) => b.startDate.getTime() - a.startDate.getTime()
          )
        );
      }

      // Calculate totals
      const totalDuration = entries.reduce((sum, e) => sum + e.duration, 0);
      const billableEntries = entries.filter((e) => e.task.isBillable);
      const billableDuration = billableEntries.reduce((sum, e) => sum + e.duration, 0);

      return {
        groups: Object.values(groupedByTask).sort((a, b) => b.totalDuration - a.totalDuration),
        timePeriodGroups,
        timeGrouping,
        summary: {
          totalDuration,
          billableDuration,
          entryCount: entries.length,
          taskCount: Object.keys(groupedByTask).length,
        },
        dateRange: { start, end },
      };
    }),

  getByTaskId: publicProcedure
    .input(z.object({ taskId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.timeEntry.findMany({
        where: { taskId: input.taskId },
        orderBy: { startTime: "desc" },
      });
    }),

  create: publicProcedure
    .input(
      z.object({
        taskId: z.string(),
        startTime: z.date(),
        endTime: z.date().optional(),
        duration: z.number().int().nonnegative(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.timeEntry.create({
        data: {
          taskId: input.taskId,
          startTime: input.startTime,
          endTime: input.endTime,
          duration: input.duration,
          notes: input.notes,
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
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        startTime: z.date().optional(),
        endTime: z.date().nullable().optional(),
        duration: z.number().int().nonnegative().optional(),
        notes: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.timeEntry.update({
        where: { id },
        data,
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
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.timeEntry.delete({
        where: { id: input.id },
      });
    }),
});
