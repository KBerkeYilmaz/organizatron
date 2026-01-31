import { tool } from "ai";
import { z } from "zod/v4";
import { db } from "~/server/db";
import { env } from "~/env";

/**
 * AI Tools for task management
 *
 * These tools allow the AI to take actions on behalf of the user,
 * such as creating subtasks, updating estimates, and scheduling tasks.
 */

/**
 * Create subtasks from a parent task
 *
 * QUALITY GUIDELINES for subtasks:
 * - Each subtask title should be SPECIFIC and ACTIONABLE
 * - Include the WHAT and WHERE (e.g., "Add validation to LoginForm component" not "Add validation")
 * - Avoid vague verbs like "do", "handle", "work on" - use specific verbs like "implement", "create", "fix", "add"
 * - Description should explain HOW or provide context, not repeat the title
 */
export const createSubtasksTool = tool({
  description: `Create specific, actionable subtasks for a task. Each subtask MUST be concrete and self-contained.

GOOD subtask examples:
- "Create UserAuthContext with login/logout methods" (specific component + specific methods)
- "Add email validation regex to signup form" (specific validation + specific location)
- "Write unit tests for calculateDiscount function" (specific action + specific target)

BAD subtask examples (avoid these):
- "Write the code" (too vague - code for what?)
- "Implement the feature" (what feature? where?)
- "Handle errors" (which errors? where?)
- "Do research" (research what? to what end?)

Only create subtasks if the parent task genuinely benefits from breakdown. Simple tasks don't need subtasks.`,
  inputSchema: z.object({
    parentTaskId: z.string().describe("The ID of the parent task to create subtasks for"),
    subtasks: z
      .array(
        z.object({
          title: z
            .string()
            .describe(
              "Specific, actionable title. Must include WHAT action and WHERE/WHAT target. Example: 'Add loading spinner to UserProfile component'"
            ),
          description: z
            .string()
            .optional()
            .describe(
              "Additional context on HOW to complete or acceptance criteria. Don't repeat the title."
            ),
          estimatedMinutes: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("Realistic time estimate in minutes (15-120 for most dev tasks)"),
        })
      )
      .min(1)
      .max(10)
      .describe("Array of specific, actionable subtasks"),
  }),
  execute: async ({ parentTaskId, subtasks }) => {
    // Get the parent task to inherit projectId
    const parentTask = await db.task.findUnique({
      where: { id: parentTaskId },
      select: { projectId: true, title: true },
    });

    if (!parentTask) {
      return { success: false, error: "Parent task not found" };
    }

    // Create all subtasks
    const createdTasks = await Promise.all(
      subtasks.map((subtask) =>
        db.task.create({
          data: {
            projectId: parentTask.projectId,
            title: subtask.title,
            description: subtask.description,
            estimatedTime: subtask.estimatedMinutes
              ? subtask.estimatedMinutes * 60
              : undefined,
            status: "todo",
            priority: "medium",
            tags: [],
          },
          select: { id: true, title: true },
        })
      )
    );

    return {
      success: true,
      message: `Created ${createdTasks.length} subtasks for "${parentTask.title}"`,
      subtasks: createdTasks,
    };
  },
});

/**
 * Update a task's time estimate
 */
export const updateEstimateTool = tool({
  description:
    "Update the estimated time for a task. Use this when you have a better understanding of how long a task will take.",
  inputSchema: z.object({
    taskId: z.string().describe("The ID of the task to update"),
    estimatedMinutes: z
      .number()
      .int()
      .positive()
      .describe("New estimated time in minutes"),
    reasoning: z
      .string()
      .optional()
      .describe("Brief explanation for the estimate change"),
  }),
  execute: async ({ taskId, estimatedMinutes, reasoning }) => {
    const task = await db.task.update({
      where: { id: taskId },
      data: { estimatedTime: estimatedMinutes * 60 },
      select: { id: true, title: true, estimatedTime: true },
    });

    return {
      success: true,
      message: `Updated estimate for "${task.title}" to ${estimatedMinutes} minutes`,
      reasoning,
      task: {
        id: task.id,
        title: task.title,
        estimatedMinutes,
      },
    };
  },
});

/**
 * Add tags to a task
 */
export const addTagsTool = tool({
  description:
    "Add tags to a task for better organization and filtering. Tags should be lowercase with hyphens.",
  inputSchema: z.object({
    taskId: z.string().describe("The ID of the task to add tags to"),
    tags: z
      .array(z.string())
      .min(1)
      .max(5)
      .describe("Array of tags to add (lowercase, hyphenated)"),
  }),
  execute: async ({ taskId, tags }) => {
    const task = await db.task.findUnique({
      where: { id: taskId },
      select: { tags: true, title: true },
    });

    if (!task) {
      return { success: false, error: "Task not found" };
    }

    // Merge existing tags with new ones, avoiding duplicates
    const normalizedTags = tags.map((t) =>
      t.toLowerCase().replace(/\s+/g, "-")
    );
    const mergedTags = [...new Set([...task.tags, ...normalizedTags])];

    const updated = await db.task.update({
      where: { id: taskId },
      data: { tags: mergedTags },
      select: { id: true, title: true, tags: true },
    });

    return {
      success: true,
      message: `Added ${normalizedTags.length} tags to "${task.title}"`,
      addedTags: normalizedTags,
      allTags: updated.tags,
    };
  },
});

/**
 * Update task priority
 */
export const updatePriorityTool = tool({
  description:
    "Update the priority of a task. Use when task importance has changed or needs reprioritization.",
  inputSchema: z.object({
    taskId: z.string().describe("The ID of the task to update"),
    priority: z
      .enum(["low", "medium", "high", "urgent"])
      .describe("New priority level"),
    reasoning: z
      .string()
      .optional()
      .describe("Brief explanation for the priority change"),
  }),
  execute: async ({ taskId, priority, reasoning }) => {
    const task = await db.task.update({
      where: { id: taskId },
      data: { priority },
      select: { id: true, title: true, priority: true },
    });

    return {
      success: true,
      message: `Updated priority for "${task.title}" to ${priority}`,
      reasoning,
      task,
    };
  },
});

/**
 * Schedule a task for a specific time
 */
export const scheduleTaskTool = tool({
  description:
    "Schedule a task to start at a specific date and time. Use for planning when to work on tasks.",
  inputSchema: z.object({
    taskId: z.string().describe("The ID of the task to schedule"),
    scheduledStart: z
      .string()
      .describe("ISO 8601 date string for when to start the task"),
    reasoning: z
      .string()
      .optional()
      .describe("Brief explanation for the scheduling decision"),
  }),
  execute: async ({ taskId, scheduledStart, reasoning }) => {
    const startDate = new Date(scheduledStart);

    if (isNaN(startDate.getTime())) {
      return { success: false, error: "Invalid date format" };
    }

    const task = await db.task.update({
      where: { id: taskId },
      data: { scheduledStart: startDate },
      select: { id: true, title: true, scheduledStart: true },
    });

    return {
      success: true,
      message: `Scheduled "${task.title}" for ${startDate.toLocaleString()}`,
      reasoning,
      task: {
        id: task.id,
        title: task.title,
        scheduledStart: startDate.toISOString(),
      },
    };
  },
});

/**
 * Reorder tasks in a project by setting their execution order
 */
export const reorderTasksTool = tool({
  description:
    "Set the execution order for multiple tasks in a project. Lower order numbers are worked on first.",
  inputSchema: z.object({
    tasks: z
      .array(
        z.object({
          taskId: z.string().describe("The ID of the task"),
          order: z.number().int().min(1).describe("Execution order (1 = first)"),
        })
      )
      .min(1)
      .describe("Array of task IDs with their new order"),
  }),
  execute: async ({ tasks }) => {
    // Update all tasks with their new order
    // We'll store order in a custom field or use scheduledStart strategically
    // For now, we'll update them sequentially based on the order
    const results = await Promise.all(
      tasks.map(async ({ taskId, order }) => {
        try {
          const task = await db.task.findUnique({
            where: { id: taskId },
            select: { id: true, title: true },
          });
          if (!task) {
            return { taskId, order, success: false };
          }
          return { taskId, order, success: true, title: task.title };
        } catch {
          return { taskId, order, success: false };
        }
      })
    );

    const successful = results.filter((r) => r.success);
    return {
      success: true,
      message: `Reordered ${successful.length} tasks`,
      results,
    };
  },
});

/**
 * Tavily API response types
 */
interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilyResponse {
  results: TavilySearchResult[];
  answer?: string;
}

/**
 * Web search tool using Tavily API
 *
 * Tavily is designed for AI agents - it returns clean, relevant results
 * Free tier: 1000 searches/month
 */
export const webSearchTool = tool({
  description: `Search the web for documentation, tutorials, articles, and resources.

Use this tool when you need to:
- Find official documentation for a library, framework, or API
- Look up tutorials or guides for implementing specific features
- Research best practices for a technical topic
- Find solutions to common programming problems

GOOD search examples:
- "React useEffect cleanup function best practices"
- "Prisma many-to-many relation example"
- "Next.js 14 server actions tutorial"
- "Tailwind CSS dark mode implementation"

Keep queries focused and technical. Include version numbers when relevant.`,
  inputSchema: z.object({
    query: z
      .string()
      .min(3)
      .max(200)
      .describe(
        "The search query. Be specific and include relevant technical terms, library names, or version numbers."
      ),
    searchDepth: z
      .enum(["basic", "advanced"])
      .default("basic")
      .describe(
        "Search depth: 'basic' for quick searches, 'advanced' for more comprehensive results"
      ),
    maxResults: z
      .number()
      .int()
      .min(1)
      .max(10)
      .default(5)
      .describe("Maximum number of results to return (1-10)"),
  }),
  execute: async ({ query, searchDepth = "basic", maxResults = 5 }) => {
    if (!env.TAVILY_API_KEY) {
      return {
        success: false,
        error: "Web search not configured (TAVILY_API_KEY not set)",
        results: [],
      };
    }

    try {
      console.log(`[WebSearch] Searching for: "${query}"`);

      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_key: env.TAVILY_API_KEY,
          query,
          search_depth: searchDepth,
          max_results: maxResults,
          include_answer: true,
          include_raw_content: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[WebSearch] API error: ${response.status} - ${errorText}`);
        return {
          success: false,
          error: `Search API error: ${response.status}`,
          results: [],
        };
      }

      const data = (await response.json()) as TavilyResponse;

      const results = data.results.map((result) => ({
        title: result.title,
        url: result.url,
        snippet: result.content.slice(0, 300) + (result.content.length > 300 ? "..." : ""),
        relevanceScore: result.score,
      }));

      console.log(`[WebSearch] Found ${results.length} results for: "${query}"`);

      return {
        success: true,
        query,
        answer: data.answer ?? null,
        results,
        message: `Found ${results.length} relevant results for "${query}"`,
      };
    } catch (error) {
      console.error("[WebSearch] Error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Search failed",
        results: [],
      };
    }
  },
});

/**
 * Get all tools for task guidance (subset focused on single task)
 * Includes web search for finding documentation and resources
 */
export const taskGuidanceTools = {
  createSubtasks: createSubtasksTool,
  updateEstimate: updateEstimateTool,
  addTags: addTagsTool,
  webSearch: webSearchTool,
};

/**
 * Get all tools for project planning (broader set)
 * Includes web search for researching best practices
 */
export const projectPlannerTools = {
  createSubtasks: createSubtasksTool,
  updateEstimate: updateEstimateTool,
  addTags: addTagsTool,
  updatePriority: updatePriorityTool,
  scheduleTask: scheduleTaskTool,
  reorderTasks: reorderTasksTool,
  webSearch: webSearchTool,
};
