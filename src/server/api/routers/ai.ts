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
   * Combined task creation assist - time estimate + tags in ONE API call.
   * This is the preferred method for inline task creation AI.
   * Saves API quota by combining two operations into one.
   */
  assistTaskCreation: publicProcedure
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

      // Get existing tags from project for context
      let existingTags: string[] = [];
      if (input.projectId) {
        const project = await ctx.db.project.findUnique({
          where: { id: input.projectId },
          include: { tasks: { select: { tags: true } } },
        });
        existingTags = [...new Set(project?.tasks.flatMap((t) => t.tags) ?? [])];
      }

      // Get similar completed tasks for time estimation context
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
        take: 5,
        orderBy: { completedAt: "desc" },
      });

      const tasksWithActual = similarTasks.map((t) => ({
        title: t.title,
        estimatedMinutes: Math.round((t.estimatedTime ?? 0) / 60),
        actualMinutes: Math.round(
          t.timeEntries.reduce((sum, e) => sum + e.duration, 0) / 60
        ),
      }));

      const result = await aiService.assistTaskCreation(
        input.title,
        input.description,
        existingTags.length > 0 ? existingTags : undefined,
        tasksWithActual.length > 0 ? tasksWithActual : undefined
      );

      if (!result) {
        return { success: false as const, error: "Failed to get AI assistance" };
      }

      return { success: true as const, data: result };
    }),

  /**
   * Estimate time for a task based on title and description
   * @deprecated Use assistTaskCreation instead for better rate limiting
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
   * @deprecated Use assistTaskCreation instead for better rate limiting
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
      const startTime = Date.now();
      console.log(`[AI] breakdownGoal started - Goal: "${input.goal.slice(0, 50)}..."`);

      if (!aiService.isAvailable()) {
        console.log("[AI] breakdownGoal failed - AI not configured");
        return { success: false as const, error: "AI not configured" };
      }

      const breakdown = await aiService.breakdownGoal(input.goal, input.context);

      if (!breakdown) {
        console.log(`[AI] breakdownGoal failed - No response from AI (${Date.now() - startTime}ms)`);
        return { success: false as const, error: "Failed to breakdown goal" };
      }

      console.log(`[AI] breakdownGoal completed - ${breakdown.tasks.length} tasks generated (${Date.now() - startTime}ms)`);
      return { success: true as const, data: breakdown };
    }),

  /**
   * Get guidance for completing a specific task
   */
  getTaskGuidance: publicProcedure
    .input(z.object({ taskId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const startTime = Date.now();
      console.log(`[AI] getTaskGuidance started - Task ID: ${input.taskId}`);

      if (!aiService.isAvailable()) {
        console.log("[AI] getTaskGuidance failed - AI not configured");
        return { success: false as const, error: "AI not configured" };
      }

      const task = await ctx.db.task.findUnique({
        where: { id: input.taskId },
        include: { project: { include: { client: true } } },
      });

      if (!task) {
        console.log(`[AI] getTaskGuidance failed - Task not found: ${input.taskId}`);
        return { success: false as const, error: "Task not found" };
      }

      console.log(`[AI] getTaskGuidance - Task: "${task.title}"`);

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
        console.log(`[AI] getTaskGuidance failed - No response from AI (${Date.now() - startTime}ms)`);
        return { success: false as const, error: "Failed to generate guidance" };
      }

      console.log(`[AI] getTaskGuidance completed (${Date.now() - startTime}ms)`);
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
      const startTime = Date.now();
      console.log(`[AI] analyzeProject started - Project ID: ${input.projectId}`);

      if (!aiService.isAvailable()) {
        console.log("[AI] analyzeProject failed - AI not configured");
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
        console.log(`[AI] analyzeProject failed - No tasks found in project: ${input.projectId}`);
        return { success: false as const, error: "No tasks found in project" };
      }

      console.log(`[AI] analyzeProject - Analyzing ${tasks.length} tasks in "${tasks[0]?.project.name}"`);

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
        console.log(`[AI] analyzeProject failed - No response from AI (${Date.now() - startTime}ms)`);
        return { success: false as const, error: "Failed to analyze project" };
      }

      console.log(`[AI] analyzeProject completed - ${plan.tasks.length} tasks scheduled (${Date.now() - startTime}ms)`);
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

  /**
   * Agentic task guidance - AI can take actions while providing guidance
   * Uses tool calling to autonomously create subtasks, update estimates, add tags
   */
  getAgenticTaskGuidance: publicProcedure
    .input(
      z.object({
        taskId: z.string(),
        maxSteps: z.number().int().min(1).max(10).default(5),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const startTime = Date.now();
      console.log(`[AI] getAgenticTaskGuidance started - Task ID: ${input.taskId}`);

      if (!aiService.isAvailable()) {
        console.log("[AI] getAgenticTaskGuidance failed - AI not configured");
        return { success: false as const, error: "AI not configured" };
      }

      const task = await ctx.db.task.findUnique({
        where: { id: input.taskId },
        include: { project: { include: { client: true } } },
      });

      if (!task) {
        console.log(`[AI] getAgenticTaskGuidance failed - Task not found: ${input.taskId}`);
        return { success: false as const, error: "Task not found" };
      }

      console.log(`[AI] getAgenticTaskGuidance - Task: "${task.title}"`);

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

      const result = await aiService.getAgenticTaskGuidance(taskContext, input.maxSteps);

      if (!result.guidance) {
        console.log(`[AI] getAgenticTaskGuidance failed - No response from AI (${Date.now() - startTime}ms)`);
        return { success: false as const, error: "Failed to generate guidance" };
      }

      console.log(`[AI] getAgenticTaskGuidance completed - ${result.actions.length} actions taken (${Date.now() - startTime}ms)`);
      return {
        success: true as const,
        data: {
          guidance: result.guidance,
          actions: result.actions,
        },
      };
    }),

  /**
   * Agentic project planner - AI can reorder tasks, schedule them, update priorities
   * Uses tool calling for autonomous project planning
   */
  getAgenticProjectPlan: publicProcedure
    .input(
      z.object({
        projectId: z.string(),
        maxSteps: z.number().int().min(1).max(20).default(10),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const startTime = Date.now();
      console.log(`[AI] getAgenticProjectPlan started - Project ID: ${input.projectId}`);

      if (!aiService.isAvailable()) {
        console.log("[AI] getAgenticProjectPlan failed - AI not configured");
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
        console.log(`[AI] getAgenticProjectPlan failed - No tasks found in project: ${input.projectId}`);
        return { success: false as const, error: "No tasks found in project" };
      }

      console.log(`[AI] getAgenticProjectPlan - Planning ${tasks.length} tasks in "${tasks[0]?.project.name}"`);

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

      const result = await aiService.getAgenticProjectPlan(taskContexts, input.maxSteps);

      if (!result.plan) {
        console.log(`[AI] getAgenticProjectPlan failed - No response from AI (${Date.now() - startTime}ms)`);
        return { success: false as const, error: "Failed to generate plan" };
      }

      console.log(`[AI] getAgenticProjectPlan completed - ${result.actions.length} actions taken (${Date.now() - startTime}ms)`);
      return {
        success: true as const,
        data: {
          plan: result.plan,
          actions: result.actions,
        },
      };
    }),
});
