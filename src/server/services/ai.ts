import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { env } from "~/env";
import type {
  AITimeEstimate,
  AITagSuggestion,
  AITaskBreakdown,
  AITaskGuidance,
  AIProjectPlan,
  TaskContext,
} from "~/lib/ai-types";

interface SimilarTask {
  title: string;
  estimatedMinutes: number;
  actualMinutes?: number;
}

/**
 * AI Service for intelligent task management
 *
 * Uses Vercel AI SDK with Google Gemini for:
 * - Time estimation
 * - Tag suggestions
 * - Goal breakdown
 * - Task guidance
 * - Project analysis
 */
export class AIService {
  // Using Gemini 2.5 Flash - best price-performance ratio
  private model = google("gemini-2.5-flash");

  /**
   * Check if AI service is available (API key configured)
   */
  isAvailable(): boolean {
    return !!env.GOOGLE_GENERATIVE_AI_API_KEY;
  }

  /**
   * Estimate time for a task based on title and description
   */
  async estimateTime(
    title: string,
    description?: string,
    similarTasks?: SimilarTask[]
  ): Promise<AITimeEstimate | null> {
    try {
      const similarTasksContext = similarTasks?.length
        ? `\n\nSimilar completed tasks for reference:\n${similarTasks
            .map(
              (t) =>
                `- "${t.title}": estimated ${t.estimatedMinutes}min, actual ${t.actualMinutes ?? "unknown"}min`
            )
            .join("\n")}`
        : "";

      const result = await generateText({
        model: this.model,
        prompt: `Estimate the time needed to complete this task.

Task: "${title}"
${description ? `Description: ${description}` : ""}
${similarTasksContext}

Respond with JSON only (no markdown):
{
  "estimatedMinutes": <number>,
  "confidence": "low" | "medium" | "high",
  "reasoning": "<brief explanation>"
}`,
      });

      return JSON.parse(result.text) as AITimeEstimate;
    } catch {
      return null;
    }
  }

  /**
   * Suggest tags for a task based on content
   */
  async suggestTags(
    title: string,
    description?: string,
    existingTags?: string[]
  ): Promise<AITagSuggestion | null> {
    try {
      const existingTagsContext = existingTags?.length
        ? `\n\nExisting tags in this project: ${existingTags.join(", ")}`
        : "";

      const result = await generateText({
        model: this.model,
        prompt: `Suggest relevant tags for this task.

Task: "${title}"
${description ? `Description: ${description}` : ""}
${existingTagsContext}

Suggest 2-5 short, lowercase tags (no spaces, use hyphens).
Respond with JSON only (no markdown):
{
  "tags": ["tag1", "tag2"],
  "reasoning": "<brief explanation>"
}`,
      });

      return JSON.parse(result.text) as AITagSuggestion;
    } catch {
      return null;
    }
  }

  /**
   * Break down a high-level goal into actionable tasks
   */
  async breakdownGoal(
    goal: string,
    context?: string
  ): Promise<AITaskBreakdown | null> {
    try {
      const contextSection = context
        ? `\n\nAdditional context: ${context}`
        : "";

      const result = await generateText({
        model: this.model,
        prompt: `Break down this goal into actionable tasks with time estimates.

Goal: "${goal}"
${contextSection}

For each task provide:
1. Clear title and description
2. Time estimate in minutes
3. Execution order (1 = do first)
4. 1-2 learning resources (articles, videos, courses) with type and description
5. Practical guidance tips

Respond with JSON only (no markdown):
{
  "goal": "<the goal>",
  "tasks": [
    {
      "title": "<task title>",
      "description": "<what to do>",
      "estimatedMinutes": <number>,
      "order": <number>,
      "guidance": "<tips for completing>",
      "learningResources": [
        {
          "title": "<resource name>",
          "type": "article" | "video" | "course" | "documentation",
          "url": "<optional url>",
          "description": "<what you'll learn>"
        }
      ]
    }
  ],
  "totalEstimatedTime": <sum of all minutes>,
  "summary": "<brief explanation of approach>"
}`,
      });

      return JSON.parse(result.text) as AITaskBreakdown;
    } catch {
      return null;
    }
  }

  /**
   * Get guidance for completing a specific task
   */
  async getTaskGuidance(task: TaskContext): Promise<AITaskGuidance | null> {
    try {
      const result = await generateText({
        model: this.model,
        prompt: `Provide guidance for completing this task.

Task: "${task.title}"
${task.description ? `Description: ${task.description}` : ""}
Project: ${task.projectName}
Priority: ${task.priority}
Tags: ${task.tags.join(", ") || "none"}
${task.dueDate ? `Due: ${task.dueDate.toISOString()}` : ""}
${task.estimatedTime ? `Estimated time: ${task.estimatedTime / 60} minutes` : ""}

Provide:
1. Step-by-step approach (guidance)
2. Relevant learning resources with URLs when possible
3. Claude Code prompts the user can copy/paste to get help
4. Whether this task should be broken down into smaller subtasks

Respond with JSON only (no markdown):
{
  "taskId": "${task.id}",
  "guidance": "<how to approach this task>",
  "suggestedPrompts": ["<prompt 1>", "<prompt 2>"],
  "learningResources": [
    {
      "title": "<resource name>",
      "type": "article" | "video" | "course" | "documentation",
      "url": "<optional url>",
      "description": "<what you'll learn>"
    }
  ],
  "breakdownSuggestion": {
    "shouldBreakdown": <boolean>,
    "suggestedSubtasks": ["<subtask 1>", "<subtask 2>"]
  }
}`,
      });

      return JSON.parse(result.text) as AITaskGuidance;
    } catch {
      return null;
    }
  }

  /**
   * Analyze project tasks and suggest optimal execution order
   */
  async analyzeProject(tasks: TaskContext[]): Promise<AIProjectPlan | null> {
    if (tasks.length === 0) {
      return null;
    }

    try {
      const tasksContext = tasks
        .map(
          (t) =>
            `- ID: ${t.id}, "${t.title}", Priority: ${t.priority}, Due: ${t.dueDate?.toISOString() ?? "none"}, Est: ${t.estimatedTime ? `${t.estimatedTime / 60}min` : "unknown"}, Tags: [${t.tags.join(", ")}]`
        )
        .join("\n");

      const result = await generateText({
        model: this.model,
        prompt: `Analyze these tasks and suggest the optimal execution order.

Project: ${tasks[0]!.projectName}
Tasks:
${tasksContext}

Consider:
- What tasks block other tasks?
- What's the logical build order?
- Due date constraints
- Priority levels

Today: ${new Date().toISOString()}
Working hours: 9:00 - 17:00

Respond with JSON only (no markdown):
{
  "tasks": [
    {
      "taskId": "<id>",
      "suggestedOrder": <number 1 = first>,
      "estimatedMinutes": <number>,
      "blockedBy": ["<taskId>"],
      "enables": ["<taskId>"],
      "guidance": "<why this order>"
    }
  ],
  "schedule": [
    {
      "taskId": "<id>",
      "suggestedStart": "<ISO date string>",
      "suggestedEnd": "<ISO date string>"
    }
  ],
  "summary": "<overall scheduling strategy>",
  "totalEstimatedTime": <total minutes>
}`,
      });

      const parsed = JSON.parse(result.text);

      // Convert date strings to Date objects
      return {
        ...parsed,
        schedule: parsed.schedule.map(
          (s: { taskId: string; suggestedStart: string; suggestedEnd: string }) => ({
            taskId: s.taskId,
            suggestedStart: new Date(s.suggestedStart),
            suggestedEnd: new Date(s.suggestedEnd),
          })
        ),
      } as AIProjectPlan;
    } catch {
      return null;
    }
  }
}

// Singleton instance
export const aiService = new AIService();
