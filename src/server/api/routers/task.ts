import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

const taskStatusEnum = z.enum(["todo", "in_progress", "completed", "archived"]);
const priorityEnum = z.enum(["low", "medium", "high", "urgent"]);
const billingStatusEnum = z.enum(["pending", "paid"]);

export const taskRouter = createTRPCRouter({
  getAll: publicProcedure
    .input(
      z
        .object({
          projectId: z.string().optional(),
          clientId: z.string().optional(),
          status: taskStatusEnum.optional(),
          statuses: z.array(taskStatusEnum).optional(),
          priority: priorityEnum.optional(),
          priorities: z.array(priorityEnum).optional(),
          search: z.string().optional(),
          isBillable: z.boolean().optional(),
          billingStatus: billingStatusEnum.optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.task.findMany({
        where: {
          projectId: input?.projectId,
          // Filter by client through project relation
          ...(input?.clientId && {
            project: { clientId: input.clientId },
          }),
          // Support both single status and array of statuses
          ...(input?.statuses && input.statuses.length > 0
            ? { status: { in: input.statuses } }
            : input?.status
              ? { status: input.status }
              : {}),
          // Support both single priority and array of priorities
          ...(input?.priorities && input.priorities.length > 0
            ? { priority: { in: input.priorities } }
            : input?.priority
              ? { priority: input.priority }
              : {}),
          // Search by title (case-insensitive)
          ...(input?.search && {
            title: { contains: input.search, mode: "insensitive" },
          }),
          // Filter by billable status
          ...(input?.isBillable !== undefined && {
            isBillable: input.isBillable,
          }),
          // Filter by billing status (pending/paid)
          ...(input?.billingStatus && {
            billingStatus: input.billingStatus,
          }),
        },
        orderBy: { createdAt: "desc" },
        include: {
          project: {
            include: { client: true },
          },
          _count: {
            select: { timeEntries: true },
          },
        },
      });
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.task.findUnique({
        where: { id: input.id },
        include: {
          project: {
            include: { client: true },
          },
          timeEntries: {
            orderBy: { startTime: "desc" },
          },
          activeTimer: true,
        },
      });
    }),

  create: publicProcedure
    .input(
      z.object({
        projectId: z.string(),
        title: z.string().min(1, "Title is required"),
        description: z.string().optional(),
        status: taskStatusEnum.optional(),
        priority: priorityEnum.optional(),
        estimatedTime: z.number().int().positive().optional(),
        dueDate: z.date().optional(),
        tags: z.array(z.string()).optional(),
        // Billing fields
        isBillable: z.boolean().optional(),
        hourlyRate: z.number().int().positive().optional(), // in cents
        currency: z.string().length(3).optional(), // ISO 4217
        billingStatus: billingStatusEnum.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.task.create({
        data: {
          projectId: input.projectId,
          title: input.title,
          description: input.description,
          status: input.status,
          priority: input.priority,
          estimatedTime: input.estimatedTime,
          dueDate: input.dueDate,
          tags: input.tags ?? [],
          isBillable: input.isBillable,
          hourlyRate: input.hourlyRate,
          currency: input.currency,
          billingStatus: input.billingStatus,
        },
        include: {
          project: {
            include: { client: true },
          },
        },
      });
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        status: taskStatusEnum.optional(),
        priority: priorityEnum.optional(),
        estimatedTime: z.number().int().positive().nullable().optional(),
        dueDate: z.date().nullable().optional(),
        tags: z.array(z.string()).optional(),
        // Billing fields
        isBillable: z.boolean().optional(),
        hourlyRate: z.number().int().positive().nullable().optional(), // in cents
        currency: z.string().length(3).optional(), // ISO 4217
        billingStatus: billingStatusEnum.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // Set completedAt when status changes to completed
      const updateData: typeof data & { completedAt?: Date | null } = { ...data };
      if (data.status === "completed") {
        updateData.completedAt = new Date();
      } else if (data.status) {
        // Clear completedAt when moving to any non-completed status
        updateData.completedAt = null;
      }

      return ctx.db.task.update({
        where: { id },
        data: updateData,
        include: {
          project: {
            include: { client: true },
          },
        },
      });
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.task.delete({
        where: { id: input.id },
      });
    }),

  // Bulk status update
  updateStatus: publicProcedure
    .input(
      z.object({
        ids: z.array(z.string()),
        status: taskStatusEnum,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const completedAt = input.status === "completed" ? new Date() : null;

      return ctx.db.task.updateMany({
        where: { id: { in: input.ids } },
        data: {
          status: input.status,
          completedAt,
        },
      });
    }),

  // Bulk delete
  deleteMany: publicProcedure
    .input(z.object({ ids: z.array(z.string()).min(1, "At least one id required") }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.task.deleteMany({
        where: { id: { in: input.ids } },
      });
    }),
});
