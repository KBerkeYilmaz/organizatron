import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const googleCalendarRouter = createTRPCRouter({
  /**
   * Get Google Calendar connection status
   */
  getStatus: publicProcedure.query(async ({ ctx }) => {
    // Get the first user (simplified single-user mode)
    // In a multi-user app, you'd get the authenticated user
    const user = await ctx.db.user.findFirst({
      include: { googleAccount: true },
    });

    if (!user || !user.googleAccount) {
      return {
        connected: false,
        email: null,
      };
    }

    return {
      connected: true,
      email: user.googleAccount.email,
    };
  }),

  /**
   * Disconnect Google account
   */
  disconnect: publicProcedure.mutation(async ({ ctx }) => {
    const user = await ctx.db.user.findFirst();

    if (!user) {
      return { success: true };
    }

    // Delete Google account
    await ctx.db.googleAccount.deleteMany({
      where: { userId: user.id },
    });

    // Clear all googleEventIds from tasks
    await ctx.db.task.updateMany({
      where: { googleEventId: { not: null } },
      data: { googleEventId: null },
    });

    return { success: true };
  }),
});
