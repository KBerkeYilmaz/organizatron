import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

const projectStatusEnum = z.enum([
  "planning",
  "active",
  "on_hold",
  "completed",
  "archived",
]);

export const projectRouter = createTRPCRouter({
  getAll: publicProcedure
    .input(
      z
        .object({
          clientId: z.string().optional(),
          status: projectStatusEnum.optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.project.findMany({
        where: {
          clientId: input?.clientId,
          status: input?.status,
        },
        orderBy: { updatedAt: "desc" },
        include: { client: true },
      });
    }),

  getByClientId: publicProcedure
    .input(z.object({ clientId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.project.findMany({
        where: { clientId: input.clientId },
        orderBy: { updatedAt: "desc" },
        include: {
          client: true,
          tasks: {
            select: { id: true, status: true },
          },
        },
      });
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.project.findUnique({
        where: { id: input.id },
        include: {
          client: true,
          tasks: {
            orderBy: { createdAt: "desc" },
          },
        },
      });
    }),

  create: publicProcedure
    .input(
      z.object({
        clientId: z.string(),
        name: z.string().min(1, "Name is required"),
        description: z.string().optional(),
        status: projectStatusEnum.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.project.create({
        data: {
          clientId: input.clientId,
          name: input.name,
          description: input.description,
          status: input.status,
        },
        include: { client: true },
      });
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        status: projectStatusEnum.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.project.update({
        where: { id },
        data,
        include: { client: true },
      });
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.project.delete({
        where: { id: input.id },
      });
    }),

  // Get the most recently active project based on time entries or task updates
  getMostRecentlyActive: publicProcedure.query(async ({ ctx }) => {
    // First try to get project with most recent time entry
    const recentTimeEntry = await ctx.db.timeEntry.findFirst({
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

    if (recentTimeEntry?.task?.project) {
      return recentTimeEntry.task.project;
    }

    // Fallback to most recently updated task's project
    const recentTask = await ctx.db.task.findFirst({
      orderBy: { updatedAt: "desc" },
      include: {
        project: {
          include: { client: true },
        },
      },
    });

    if (recentTask?.project) {
      return recentTask.project;
    }

    // Final fallback: most recently updated project
    return ctx.db.project.findFirst({
      orderBy: { updatedAt: "desc" },
      include: { client: true },
    });
  }),
});
