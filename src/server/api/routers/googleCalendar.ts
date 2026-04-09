import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { GoogleCalendarService } from "~/server/services/google-calendar";

export const googleCalendarRouter = createTRPCRouter({
  /**
   * Get Google Calendar connection status for the logged-in user
   */
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const googleAccount = await ctx.db.googleAccount.findUnique({
      where: { userId: ctx.user.id },
      select: { email: true },
    });

    if (!googleAccount) {
      return { connected: false, email: null };
    }

    return { connected: true, email: googleAccount.email };
  }),

  /**
   * Test calendar connection by creating and immediately deleting a test event
   */
  testConnection: protectedProcedure.mutation(async ({ ctx }) => {
    const now = new Date();
    const end = new Date(now.getTime() + 30 * 60 * 1000); // 30 min

    const result = await GoogleCalendarService.createEvent(ctx.user.id, {
      title: "[Test] Organizatron sync check",
      description: "This event was created to test Google Calendar sync. It can be deleted.",
      scheduledStart: now,
      dueDate: end,
      estimatedTime: 1800,
    });

    if (result.success && result.eventId) {
      // Clean up the test event
      await GoogleCalendarService.deleteEvent(ctx.user.id, result.eventId);
    }

    return result;
  }),

  /**
   * Disconnect Google Calendar for the logged-in user
   */
  disconnect: protectedProcedure.mutation(async ({ ctx }) => {
    // Delete Google account
    await ctx.db.googleAccount.deleteMany({
      where: { userId: ctx.user.id },
    });

    // Clear all googleEventIds from tasks
    await ctx.db.task.updateMany({
      where: { googleEventId: { not: null } },
      data: { googleEventId: null },
    });

    return { success: true };
  }),
});
