import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { GoogleCalendarService } from "~/server/services/google-calendar";
import type { PrismaClient } from "@prisma/client";

const taskStatusEnum = z.enum(["todo", "in_progress", "completed", "archived"]);
const priorityEnum = z.enum(["low", "medium", "high", "urgent"]);
const billingStatusEnum = z.enum(["pending", "paid"]);

// Helper to get current user ID (simplified single-user mode)
async function getCurrentUserId(db: PrismaClient): Promise<string | null> {
  const user = await db.user.findFirst();
  return user?.id ?? null;
}

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
        scheduledStart: z.date().optional(), // When to work on the task
        tags: z.array(z.string()).optional(),
        // Billing fields
        isBillable: z.boolean().optional(),
        hourlyRate: z.number().int().positive().optional(), // in cents
        currency: z.string().length(3).optional(), // ISO 4217
        billingStatus: billingStatusEnum.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Create task first
      const task = await ctx.db.task.create({
        data: {
          projectId: input.projectId,
          title: input.title,
          description: input.description,
          status: input.status,
          priority: input.priority,
          estimatedTime: input.estimatedTime,
          dueDate: input.dueDate,
          scheduledStart: input.scheduledStart,
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

      // Sync to Google Calendar if task has scheduledStart or dueDate
      if (task.scheduledStart || task.dueDate) {
        try {
          const userId = await getCurrentUserId(ctx.db);
          if (userId) {
            const result = await GoogleCalendarService.createEvent(userId, {
              title: task.title,
              description: task.description,
              scheduledStart: task.scheduledStart,
              dueDate: task.dueDate,
              estimatedTime: task.estimatedTime,
            });

            if (result.success && result.eventId) {
              // Update task with Google event ID
              return ctx.db.task.update({
                where: { id: task.id },
                data: { googleEventId: result.eventId },
                include: { project: { include: { client: true } } },
              });
            }
          }
        } catch (error) {
          // Log but don't fail the task creation
          console.error("[Task.create] Google Calendar sync error:", error);
        }
      }

      return task;
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
        scheduledStart: z.date().nullable().optional(), // When to work on the task
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

      // Get existing task to check for googleEventId and time fields
      const existingTask = await ctx.db.task.findUnique({
        where: { id },
        select: { googleEventId: true, scheduledStart: true, dueDate: true },
      });

      // Set completedAt when status changes to completed
      const updateData: typeof data & { completedAt?: Date | null; googleEventId?: string | null } = { ...data };
      if (data.status === "completed") {
        updateData.completedAt = new Date();
      } else if (data.status) {
        // Clear completedAt when moving to any non-completed status
        updateData.completedAt = null;
      }

      // Update task
      const task = await ctx.db.task.update({
        where: { id },
        data: updateData,
        include: {
          project: {
            include: { client: true },
          },
        },
      });

      // Sync to Google Calendar
      try {
        const userId = await getCurrentUserId(ctx.db);
        if (userId) {
          // Completed tasks no longer need calendar events
          if (task.status === "completed" && existingTask?.googleEventId) {
            await GoogleCalendarService.deleteEvent(userId, existingTask.googleEventId);
            await ctx.db.task.update({ where: { id }, data: { googleEventId: null } });
          } else {
            const hasTimeInfo = task.scheduledStart || task.dueDate;

            if (hasTimeInfo) {
              // Task has time info - create or update event
              if (existingTask?.googleEventId) {
                // Update existing event
                const result = await GoogleCalendarService.updateEvent(
                  userId,
                  existingTask.googleEventId,
                  {
                    title: task.title,
                    description: task.description,
                    scheduledStart: task.scheduledStart,
                    dueDate: task.dueDate,
                    estimatedTime: task.estimatedTime,
                  }
                );

                // If update created a new event (old one was deleted from Google)
                if (result.success && result.eventId && result.eventId !== existingTask.googleEventId) {
                  await ctx.db.task.update({
                    where: { id },
                    data: { googleEventId: result.eventId },
                  });
                }
              } else {
                // Create new event
                const result = await GoogleCalendarService.createEvent(userId, {
                  title: task.title,
                  description: task.description,
                  scheduledStart: task.scheduledStart,
                  dueDate: task.dueDate,
                  estimatedTime: task.estimatedTime,
                });

                if (result.success && result.eventId) {
                  await ctx.db.task.update({
                    where: { id },
                    data: { googleEventId: result.eventId },
                  });
                }
              }
            } else if (existingTask?.googleEventId) {
              // Both scheduledStart and dueDate were removed - delete event
              await GoogleCalendarService.deleteEvent(userId, existingTask.googleEventId);
              await ctx.db.task.update({
                where: { id },
                data: { googleEventId: null },
              });
            }
          }
        }
      } catch (error) {
        // Log but don't fail the task update
        console.error("[Task.update] Google Calendar sync error:", error);
      }

      return task;
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Get task to check for googleEventId before deletion
      const task = await ctx.db.task.findUnique({
        where: { id: input.id },
        select: { googleEventId: true },
      });

      // Delete from Google Calendar if synced
      if (task?.googleEventId) {
        try {
          const userId = await getCurrentUserId(ctx.db);
          if (userId) {
            await GoogleCalendarService.deleteEvent(userId, task.googleEventId);
          }
        } catch (error) {
          // Log but don't fail the task deletion
          console.error("[Task.delete] Google Calendar sync error:", error);
        }
      }

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

      // If completing tasks, clean up their Google Calendar events
      if (input.status === "completed") {
        const tasks = await ctx.db.task.findMany({
          where: { id: { in: input.ids }, googleEventId: { not: null } },
          select: { googleEventId: true },
        });
        const eventIds = tasks
          .map((t) => t.googleEventId)
          .filter((id): id is string => id !== null);

        if (eventIds.length > 0) {
          try {
            const userId = await getCurrentUserId(ctx.db);
            if (userId) {
              await Promise.allSettled(
                eventIds.map((eventId) =>
                  GoogleCalendarService.deleteEvent(userId, eventId)
                )
              );
              // Clear googleEventId on completed tasks
              await ctx.db.task.updateMany({
                where: { id: { in: input.ids }, googleEventId: { not: null } },
                data: { googleEventId: null },
              });
            }
          } catch (error) {
            console.error("[Task.updateStatus] Google Calendar sync error:", error);
          }
        }
      }

      return ctx.db.task.updateMany({
        where: { id: { in: input.ids } },
        data: { status: input.status, completedAt },
      });
    }),

  // Bulk delete
  deleteMany: publicProcedure
    .input(z.object({ ids: z.array(z.string()).min(1, "At least one id required") }))
    .mutation(async ({ ctx, input }) => {
      // Get tasks with googleEventIds before deletion
      const tasks = await ctx.db.task.findMany({
        where: { id: { in: input.ids } },
        select: { googleEventId: true },
      });

      // Delete from Google Calendar for any synced tasks
      const eventIds = tasks
        .map((t) => t.googleEventId)
        .filter((id): id is string => id !== null);

      if (eventIds.length > 0) {
        try {
          const userId = await getCurrentUserId(ctx.db);
          if (userId) {
            // Delete all events (parallel, non-blocking)
            await Promise.allSettled(
              eventIds.map((eventId) =>
                GoogleCalendarService.deleteEvent(userId, eventId)
              )
            );
          }
        } catch (error) {
          // Log but don't fail the task deletion
          console.error("[Task.deleteMany] Google Calendar sync error:", error);
        }
      }

      return ctx.db.task.deleteMany({
        where: { id: { in: input.ids } },
      });
    }),
});
