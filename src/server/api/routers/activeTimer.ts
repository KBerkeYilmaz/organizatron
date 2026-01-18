import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const activeTimerRouter = createTRPCRouter({
  // Get the current active timer (if any)
  getCurrent: publicProcedure.query(async ({ ctx }) => {
    // For now, get the first active timer (later: filter by userId)
    return ctx.db.activeTimer.findFirst({
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

  // Start a timer for a task
  start: publicProcedure
    .input(z.object({ taskId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Check if there's already an active timer
      const existingTimer = await ctx.db.activeTimer.findFirst();

      if (existingTimer) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A timer is already running. Stop it before starting a new one.",
        });
      }

      // Check if task exists
      const task = await ctx.db.task.findUnique({
        where: { id: input.taskId },
      });

      if (!task) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Task not found",
        });
      }

      return ctx.db.activeTimer.create({
        data: {
          taskId: input.taskId,
          startTime: new Date(),
          elapsed: 0,
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

  // Pause the current timer (saves elapsed time)
  pause: publicProcedure.mutation(async ({ ctx }) => {
    const timer = await ctx.db.activeTimer.findFirst();

    if (!timer) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No active timer to pause",
      });
    }

    if (timer.isPaused) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Timer is already paused",
      });
    }

    // Calculate elapsed time since start
    const now = new Date();
    const elapsedSinceStart = Math.floor(
      (now.getTime() - timer.startTime.getTime()) / 1000
    );
    const totalElapsed = timer.elapsed + elapsedSinceStart;

    return ctx.db.activeTimer.update({
      where: { id: timer.id },
      data: {
        elapsed: totalElapsed,
        isPaused: true,
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

  // Resume a paused timer
  resume: publicProcedure.mutation(async ({ ctx }) => {
    const timer = await ctx.db.activeTimer.findFirst();

    if (!timer) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No timer to resume",
      });
    }

    if (!timer.isPaused) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Timer is not paused",
      });
    }

    return ctx.db.activeTimer.update({
      where: { id: timer.id },
      data: {
        startTime: new Date(), // Reset start time to now
        isPaused: false,
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

  // Stop the timer and create a time entry
  stop: publicProcedure.mutation(async ({ ctx }) => {
    const timer = await ctx.db.activeTimer.findFirst();

    if (!timer) {
      // Return null instead of throwing - timer might have already been stopped
      // This handles race conditions from rapid clicks or multiple tabs
      return null;
    }

    // Calculate total duration (if paused, elapsed is already final)
    const now = new Date();
    let totalDuration = timer.elapsed;
    if (!timer.isPaused) {
      const elapsedSinceStart = Math.floor(
        (now.getTime() - timer.startTime.getTime()) / 1000
      );
      totalDuration = timer.elapsed + elapsedSinceStart;
    }

    // Create time entry
    const timeEntry = await ctx.db.timeEntry.create({
      data: {
        taskId: timer.taskId,
        startTime: new Date(now.getTime() - totalDuration * 1000),
        endTime: now,
        duration: totalDuration,
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

    // Delete the active timer
    await ctx.db.activeTimer.delete({
      where: { id: timer.id },
    });

    return timeEntry;
  }),

  // Discard the timer without saving
  discard: publicProcedure.mutation(async ({ ctx }) => {
    const timer = await ctx.db.activeTimer.findFirst();

    if (!timer) {
      // Return null instead of throwing - timer might have already been discarded
      // This handles race conditions from rapid clicks or multiple tabs
      return null;
    }

    return ctx.db.activeTimer.delete({
      where: { id: timer.id },
    });
  }),
});
