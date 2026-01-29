import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { aiService } from "~/server/services/ai";
import type { TaskContext } from "~/lib/ai-types";

export const aiRouter = createTRPCRouter({
  /**
   * Check if AI service is available
   */
  getStatus: publicProcedure.query(() => ({
    available: aiService.isAvailable(),
  })),

  /**
   * Estimate time for a task based on title and description
   */
  estimateTime: publicProcedure
    .input(
      z.object({
        title: z.string().min(1),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!aiService.isAvailable()) {
        return { success: false as const, error: "AI not configured" };
      }

      // Get similar completed tasks for context
      const similarTasks = await ctx.db.task.findMany({
        where: {
          status: "completed",
          estimatedTime: { not: null },
        },
        select: {
          title: true,
          estimatedTime: true,
          timeEntries: {
            select: { duration: true },
          },
        },
        take: 10,
        orderBy: { completedAt: "desc" },
      });

      const tasksWithActual = similarTasks.map((t) => ({
        title: t.title,
        estimatedMinutes: Math.round((t.estimatedTime ?? 0) / 60),
        actualMinutes: Math.round(
          t.timeEntries.reduce((sum, e) => sum + e.duration, 0) / 60
        ),
      }));

      const estimate = await aiService.estimateTime(
        input.title,
        input.description,
        tasksWithActual.length > 0 ? tasksWithActual : undefined
      );

      if (!estimate) {
        return { success: false as const, error: "Failed to generate estimate" };
      }

      return { success: true as const, data: estimate };
    }),

  /**
   * Suggest tags for a task
   */
  suggestTags: publicProcedure
    .input(
      z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        projectId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!aiService.isAvailable()) {
        return { success: false as const, error: "AI not configured" };
      }

      let existingTags: string[] = [];

      if (input.projectId) {
        const project = await ctx.db.project.findUnique({
          where: { id: input.projectId },
          include: { tasks: { select: { tags: true } } },
        });
        existingTags = [...new Set(project?.tasks.flatMap((t) => t.tags) ?? [])];
      }

      const suggestion = await aiService.suggestTags(
        input.title,
        input.description,
        existingTags.length > 0 ? existingTags : undefined
      );

      if (!suggestion) {
        return { success: false as const, error: "Failed to generate suggestions" };
      }

      return { success: true as const, data: suggestion };
    }),

  /**
   * Break down a goal into actionable tasks
   */
  breakdownGoal: publicProcedure
    .input(
      z.object({
        goal: z.string().min(1),
        context: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      if (!aiService.isAvailable()) {
        return { success: false as const, error: "AI not configured" };
      }

      const breakdown = await aiService.breakdownGoal(input.goal, input.context);

      if (!breakdown) {
        return { success: false as const, error: "Failed to breakdown goal" };
      }

      return { success: true as const, data: breakdown };
    }),

  /**
   * Get guidance for completing a specific task
   */
  getTaskGuidance: publicProcedure
    .input(z.object({ taskId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!aiService.isAvailable()) {
        return { success: false as const, error: "AI not configured" };
      }

      const task = await ctx.db.task.findUnique({
        where: { id: input.taskId },
        include: { project: { include: { client: true } } },
      });

      if (!task) {
        return { success: false as const, error: "Task not found" };
      }

      const taskContext: TaskContext = {
        id: task.id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        dueDate: task.dueDate,
        estimatedTime: task.estimatedTime,
        tags: task.tags,
        projectName: task.project.name,
        clientName: task.project.client.name,
      };

      const guidance = await aiService.getTaskGuidance(taskContext);

      if (!guidance) {
        return { success: false as const, error: "Failed to generate guidance" };
      }

      return { success: true as const, data: guidance };
    }),

  /**
   * Analyze project tasks and suggest execution order
   */
  analyzeProject: publicProcedure
    .input(
      z.object({
        projectId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!aiService.isAvailable()) {
        return { success: false as const, error: "AI not configured" };
      }

      const tasks = await ctx.db.task.findMany({
        where: {
          projectId: input.projectId,
          status: { in: ["todo", "in_progress"] },
        },
        include: { project: { include: { client: true } } },
      });

      if (tasks.length === 0) {
        return { success: false as const, error: "No tasks found in project" };
      }

      const taskContexts: TaskContext[] = tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        priority: t.priority,
        status: t.status,
        dueDate: t.dueDate,
        estimatedTime: t.estimatedTime,
        tags: t.tags,
        projectName: t.project.name,
        clientName: t.project.client.name,
      }));

      const plan = await aiService.analyzeProject(taskContexts);

      if (!plan) {
        return { success: false as const, error: "Failed to analyze project" };
      }

      return { success: true as const, data: plan };
    }),

  /**
   * Apply AI-suggested schedule to tasks
   */
  applySchedule: publicProcedure
    .input(
      z.object({
        schedule: z.array(
          z.object({
            taskId: z.string(),
            suggestedStart: z.date(),
          })
        ),
        syncToCalendar: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const results: { taskId: string; success: boolean; error?: string }[] = [];

      for (const item of input.schedule) {
        try {
          await ctx.db.task.update({
            where: { id: item.taskId },
            data: { scheduledStart: item.suggestedStart },
          });

          // TODO: Add Google Calendar sync when syncToCalendar is true
          // This will reuse existing GoogleCalendarService

          results.push({ taskId: item.taskId, success: true });
        } catch (error) {
          results.push({
            taskId: item.taskId,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      return { results };
    }),
});
