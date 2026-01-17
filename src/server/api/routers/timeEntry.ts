import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

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
