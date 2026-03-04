import { generateText, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { env } from "~/env";
import type {
  AITimeEstimate,
  AITagSuggestion,
  AITaskAssist,
  AITaskBreakdown,
  AITaskGuidance,
  AIProjectPlan,
  TaskContext,
} from "~/lib/ai-types";
import { taskGuidanceTools, projectPlannerTools } from "./ai-tools";

interface SimilarTask {
  title: string;
  estimatedMinutes: number;
  actualMinutes?: number;
}

/**
 * Strip markdown code block wrappers from AI response if present
 */
function stripMarkdownCodeBlock(text: string): string {
  const trimmed = text.trim();
  // Match ```json ... ``` or ``` ... ```
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return match ? match[1]! : trimmed;
}

/**
 * AI Service for intelligent task management
 *
 * Uses Vercel AI SDK with Groq (Llama 3.3 70B) as primary provider,
 * falling back to Google Gemini if Groq is not configured.
 *
 * Features:
 * - Time estimation
 * - Tag suggestions
 * - Goal breakdown
 * - Task guidance
 * - Project analysis
 *
 * Groq rate limits (free tier): 30 RPM, 14,400 RPD - much better than Gemini!
 */
export class AIService {
  // Groq with Llama 3.3 70B - excellent free tier limits (30 RPM, 14,400 RPD)
  private groq = env.GROQ_API_KEY
    ? createGroq({ apiKey: env.GROQ_API_KEY })
    : null;

  // Fallback to Gemini 2.5 Flash if Groq not configured
  private gemini = env.GOOGLE_GENERATIVE_AI_API_KEY
    ? google("gemini-2.5-flash")
    : null;

  // Get the best available model
  private get model() {
    if (this.groq) {
      return this.groq("llama-3.3-70b-versatile");
    }
    if (this.gemini) {
      return this.gemini;
    }
    throw new Error("No AI provider configured");
  }

  /**
   * Check if AI service is available (at least one API key configured)
   */
  isAvailable(): boolean {
    return !!env.GROQ_API_KEY || !!env.GOOGLE_GENERATIVE_AI_API_KEY;
  }

  /**
   * Get the name of the active AI provider for debugging
   */
  getProviderName(): string {
    if (this.groq) return "Groq (Llama 3.3 70B)";
    if (this.gemini) return "Google Gemini 2.5 Flash";
    return "None";
  }

  /**
   * Combined task creation assist - estimates time AND suggests tags in ONE API call.
   * This is critical for staying within rate limits.
   * Uses generateText with JSON parsing (Llama 3.3 doesn't support structured outputs).
   */
  async assistTaskCreation(
    title: string,
    description?: string,
    existingTags?: string[],
    similarTasks?: SimilarTask[]
  ): Promise<AITaskAssist | null> {
    const startTime = Date.now();
    console.log(`[AIService] assistTaskCreation - Starting for: "${title}"`);

    try {
      const similarTasksContext = similarTasks?.length
        ? `\n\nSimilar completed tasks for time reference:\n${similarTasks
            .map(
              (t) =>
                `- "${t.title}": estimated ${t.estimatedMinutes}min, actual ${t.actualMinutes ?? "unknown"}min`
            )
            .join("\n")}`
        : "";

      const existingTagsContext = existingTags?.length
        ? `\n\nExisting tags in this project (prefer reusing these): ${existingTags.join(", ")}`
        : "";

      console.log(`[AIService] assistTaskCreation - Calling ${this.getProviderName()} (single combined call)...`);

      const result = await generateText({
        model: this.model,
        prompt: `Analyze this task and provide BOTH a time estimate AND relevant tags.

Task: "${title}"
${description ? `Description: ${description}` : ""}
${similarTasksContext}
${existingTagsContext}

For time estimation:
- Consider task complexity, dependencies, and similar past tasks
- Be realistic - most coding tasks take longer than expected

For tags:
- Suggest 2-5 short, lowercase tags (use hyphens, no spaces)
- Prefer reusing existing project tags when they fit
- Tags should help with filtering/organization

Respond with JSON only (no markdown):
{
  "timeEstimate": {
    "estimatedMinutes": <number>,
    "confidence": "low" | "medium" | "high",
    "reasoning": "<brief explanation>"
  },
  "tagSuggestion": {
    "tags": ["tag1", "tag2"],
    "reasoning": "<brief explanation>"
  }
}`,
      });

      const parsed = JSON.parse(stripMarkdownCodeBlock(result.text)) as AITaskAssist;

      console.log(
        `[AIService] assistTaskCreation - Success! ${parsed.timeEstimate.estimatedMinutes}min, tags: [${parsed.tagSuggestion.tags.join(", ")}] (${Date.now() - startTime}ms)`
      );

      return parsed;
    } catch (error) {
      console.error(`[AIService] assistTaskCreation - Error (${Date.now() - startTime}ms):`, error);
      return null;
    }
  }

  /**
   * Estimate time for a task based on title and description
   */
  async estimateTime(
    title: string,
    description?: string,
    similarTasks?: SimilarTask[]
  ): Promise<AITimeEstimate | null> {
    const startTime = Date.now();
    console.log(`[AIService] estimateTime - Starting for: "${title}"`);
    if (similarTasks?.length) {
      console.log(`[AIService] estimateTime - Using ${similarTasks.length} similar tasks for context`);
    }

    try {
      console.log(`[AIService] estimateTime - Calling ${this.getProviderName()}...`);
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

      const parsed = JSON.parse(stripMarkdownCodeBlock(result.text)) as AITimeEstimate;
      console.log(`[AIService] estimateTime - Success! ${parsed.estimatedMinutes}min (${parsed.confidence} confidence) (${Date.now() - startTime}ms)`);
      return parsed;
    } catch (error) {
      console.error(`[AIService] estimateTime - Error (${Date.now() - startTime}ms):`, error);
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
    const startTime = Date.now();
    console.log(`[AIService] suggestTags - Starting for: "${title}"`);
    if (existingTags?.length) {
      console.log(`[AIService] suggestTags - Existing tags: ${existingTags.join(', ')}`);
    }

    try {
      console.log(`[AIService] suggestTags - Calling ${this.getProviderName()}...`);
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

      const parsed = JSON.parse(stripMarkdownCodeBlock(result.text)) as AITagSuggestion;
      console.log(`[AIService] suggestTags - Success! Suggested: ${parsed.tags.join(', ')} (${Date.now() - startTime}ms)`);
      return parsed;
    } catch (error) {
      console.error(`[AIService] suggestTags - Error (${Date.now() - startTime}ms):`, error);
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
    const startTime = Date.now();
    console.log(`[AIService] breakdownGoal - Starting goal breakdown`);
    console.log(`[AIService] breakdownGoal - Goal: "${goal.slice(0, 100)}${goal.length > 100 ? '...' : ''}"`);
    if (context) {
      console.log(`[AIService] breakdownGoal - Context provided: "${context.slice(0, 50)}..."`);
    }

    try {
      const contextSection = context
        ? `\n\nAdditional context: ${context}`
        : "";

      console.log(`[AIService] breakdownGoal - Calling ${this.getProviderName()}...`);
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

      const parsed = JSON.parse(stripMarkdownCodeBlock(result.text)) as AITaskBreakdown;
      console.log(`[AIService] breakdownGoal - Success! Generated ${parsed.tasks.length} tasks (${Date.now() - startTime}ms)`);
      console.log(`[AIService] breakdownGoal - Summary: "${parsed.summary.slice(0, 100)}..."`);
      return parsed;
    } catch (error) {
      console.error(`[AIService] breakdownGoal - Error (${Date.now() - startTime}ms):`, error);
      return null;
    }
  }

  /**
   * Get guidance for completing a specific task
   */
  async getTaskGuidance(task: TaskContext): Promise<AITaskGuidance | null> {
    const startTime = Date.now();
    console.log(`[AIService] getTaskGuidance - Starting for task: "${task.title}"`);
    console.log(`[AIService] getTaskGuidance - Project: ${task.projectName}, Priority: ${task.priority}`);

    try {
      console.log(`[AIService] getTaskGuidance - Calling ${this.getProviderName()}...`);
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

      const parsed = JSON.parse(stripMarkdownCodeBlock(result.text)) as AITaskGuidance;
      console.log(`[AIService] getTaskGuidance - Success! (${Date.now() - startTime}ms)`);
      console.log(`[AIService] getTaskGuidance - Has breakdown suggestion: ${parsed.breakdownSuggestion?.shouldBreakdown ?? false}`);
      return parsed;
    } catch (error) {
      console.error(`[AIService] getTaskGuidance - Error (${Date.now() - startTime}ms):`, error);
      return null;
    }
  }

  /**
   * Analyze project tasks and suggest optimal execution order
   */
  async analyzeProject(tasks: TaskContext[]): Promise<AIProjectPlan | null> {
    const startTime = Date.now();
    console.log(`[AIService] analyzeProject - Starting analysis for ${tasks.length} tasks`);

    if (tasks.length === 0) {
      console.log(`[AIService] analyzeProject - No tasks to analyze`);
      return null;
    }

    console.log(`[AIService] analyzeProject - Project: ${tasks[0]?.projectName}`);

    try {
      console.log(`[AIService] analyzeProject - Calling ${this.getProviderName()}...`);
      const tasksContext = tasks
        .map(
          (t) =>
            `- ID: ${t.id}, "${t.title}", Priority: ${t.priority}, Due: ${t.dueDate?.toISOString() ?? "none"}, Est: ${t.estimatedTime ? `${t.estimatedTime / 60}min` : "unknown"}, Tags: [${t.tags.join(", ")}]`
        )
        .join("\n");

      const apiResult = await generateText({
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

      const parsed = JSON.parse(stripMarkdownCodeBlock(apiResult.text));

      // Convert date strings to Date objects
      const plan = {
        ...parsed,
        schedule: parsed.schedule.map(
          (s: { taskId: string; suggestedStart: string; suggestedEnd: string }) => ({
            taskId: s.taskId,
            suggestedStart: new Date(s.suggestedStart),
            suggestedEnd: new Date(s.suggestedEnd),
          })
        ),
      } as AIProjectPlan;

      console.log(`[AIService] analyzeProject - Success! ${plan.tasks.length} tasks scheduled (${Date.now() - startTime}ms)`);
      console.log(`[AIService] analyzeProject - Summary: "${plan.summary.slice(0, 100)}..."`);
      return plan;
    } catch (error) {
      console.error(`[AIService] analyzeProject - Error (${Date.now() - startTime}ms):`, error);
      return null;
    }
  }

  /**
   * Agentic task guidance - AI can take actions (create subtasks, update estimates, add tags)
   * Uses tool calling to let the AI autonomously help with task management.
   */
  async getAgenticTaskGuidance(
    task: TaskContext,
    maxSteps = 5
  ): Promise<{
    guidance: AITaskGuidance | null;
    actions: Array<{ tool: string; result: unknown }>;
  }> {
    const startTime = Date.now();
    console.log(`[AIService] getAgenticTaskGuidance - Starting for task: "${task.title}"`);
    console.log(`[AIService] getAgenticTaskGuidance - Max steps: ${maxSteps}`);

    const actions: Array<{ tool: string; result: unknown }> = [];

    try {
      console.log(`[AIService] getAgenticTaskGuidance - Calling ${this.getProviderName()} with tools...`);

      const result = await generateText({
        model: this.model,
        tools: taskGuidanceTools,
        stopWhen: stepCountIs(maxSteps),
        prompt: `You are a productivity coach helping with task management. Analyze this task and help the user.

Task ID: ${task.id}
Task: "${task.title}"
${task.description ? `Description: ${task.description}` : ""}
Project: ${task.projectName}
Priority: ${task.priority}
Tags: ${task.tags.join(", ") || "none"}
${task.dueDate ? `Due: ${task.dueDate.toISOString()}` : ""}
${task.estimatedTime ? `Estimated time: ${task.estimatedTime / 60} minutes` : "No time estimate set"}

You have access to tools to help the user:
- createSubtasks: Break down this task into smaller subtasks if it's complex
- updateEstimate: Update the time estimate if you think it's inaccurate
- addTags: Add relevant tags for better organization
- webSearch: Search for documentation, tutorials, and best practices

CRITICAL RULES FOR SUBTASKS:
If you use createSubtasks, each subtask MUST be:
1. SPECIFIC: Include the exact component, file, function, or feature being worked on
2. ACTIONABLE: Use concrete verbs (implement, create, add, fix, write, configure, test)
3. SELF-CONTAINED: Someone could work on it without needing to ask "what exactly?"

GOOD subtask examples:
- "Create AuthContext with login/logout/register methods"
- "Add form validation to CheckoutForm using Zod schema"
- "Write unit tests for useCart hook"
- "Configure ESLint rules for import ordering"

BAD subtask examples (NEVER create these):
- "Write the code" ❌
- "Implement the feature" ❌
- "Handle edge cases" ❌
- "Do testing" ❌
- "Work on frontend" ❌

IMPORTANT: Only create subtasks if the task genuinely benefits from breakdown. Simple tasks don't need subtasks.

After using any tools (or deciding not to), provide your guidance as JSON:
{
  "taskId": "${task.id}",
  "guidance": "<step-by-step approach for this task>",
  "suggestedPrompts": ["<Claude Code prompt 1>", "<Claude Code prompt 2>"],
  "learningResources": [
    {
      "title": "<resource name>",
      "type": "article" | "video" | "course" | "documentation",
      "url": "<optional url>",
      "description": "<what you'll learn>"
    }
  ],
  "breakdownSuggestion": {
    "shouldBreakdown": <boolean - false if you already created subtasks>,
    "suggestedSubtasks": ["<specific subtask 1>", "<specific subtask 2>"]
  }
}`,
      });

      // Collect tool call results from all steps
      for (const step of result.steps) {
        if (step.toolResults) {
          for (const toolResult of step.toolResults) {
            actions.push({
              tool: toolResult.toolName,
              result: toolResult.output,
            });
            console.log(`[AIService] getAgenticTaskGuidance - Tool called: ${toolResult.toolName}`);
          }
        }
      }

      // Parse the final text response as guidance
      let guidance: AITaskGuidance | null = null;
      try {
        guidance = JSON.parse(stripMarkdownCodeBlock(result.text)) as AITaskGuidance;
      } catch {
        console.log(`[AIService] getAgenticTaskGuidance - Could not parse guidance JSON, using raw text`);
        // If JSON parsing fails, create a basic guidance object
        guidance = {
          taskId: task.id,
          guidance: result.text,
          suggestedPrompts: [],
          learningResources: [],
          breakdownSuggestion: { shouldBreakdown: false, suggestedSubtasks: [] },
        };
      }

      console.log(`[AIService] getAgenticTaskGuidance - Success! ${actions.length} actions taken (${Date.now() - startTime}ms)`);
      return { guidance, actions };
    } catch (error) {
      console.error(`[AIService] getAgenticTaskGuidance - Error (${Date.now() - startTime}ms):`, error);
      return { guidance: null, actions };
    }
  }

  /**
   * Agentic project planner - AI can reorder tasks, schedule them, update priorities
   * Uses tool calling for autonomous project planning.
   */
  async getAgenticProjectPlan(
    tasks: TaskContext[],
    maxSteps = 10
  ): Promise<{
    plan: AIProjectPlan | null;
    actions: Array<{ tool: string; result: unknown }>;
  }> {
    const startTime = Date.now();
    console.log(`[AIService] getAgenticProjectPlan - Starting for ${tasks.length} tasks`);

    if (tasks.length === 0) {
      console.log(`[AIService] getAgenticProjectPlan - No tasks to plan`);
      return { plan: null, actions: [] };
    }

    const actions: Array<{ tool: string; result: unknown }> = [];

    try {
      console.log(`[AIService] getAgenticProjectPlan - Calling ${this.getProviderName()} with tools...`);

      const tasksContext = tasks
        .map(
          (t) =>
            `- ID: ${t.id}, "${t.title}", Priority: ${t.priority}, Due: ${t.dueDate?.toISOString() ?? "none"}, Est: ${t.estimatedTime ? `${t.estimatedTime / 60}min` : "unknown"}, Tags: [${t.tags.join(", ")}]`
        )
        .join("\n");

      const result = await generateText({
        model: this.model,
        tools: projectPlannerTools,
        stopWhen: stepCountIs(maxSteps),
        prompt: `You are a project planning assistant. Analyze these tasks and create an optimal execution plan.

Project: ${tasks[0]!.projectName}
Tasks:
${tasksContext}

Today: ${new Date().toISOString()}
Working hours: 9:00 - 17:00

You have access to tools to help organize this project:
- createSubtasks: Break down complex tasks into smaller pieces
- updateEstimate: Fix inaccurate time estimates
- addTags: Add tags for better organization
- updatePriority: Adjust priorities based on dependencies and deadlines
- scheduleTask: Schedule tasks for specific times
- reorderTasks: Set execution order for tasks
- webSearch: Search for documentation and best practices when needed

CRITICAL RULES FOR SUBTASKS:
If you use createSubtasks, each subtask MUST be:
1. SPECIFIC: Include the exact component, file, function, or feature
2. ACTIONABLE: Use concrete verbs (implement, create, add, fix, write, configure, test)
3. SELF-CONTAINED: Clear enough that someone could start immediately

GOOD: "Add email validation to RegistrationForm component"
BAD: "Implement validation" ❌

IMPORTANT: Use tools strategically to improve the project plan. Consider:
- Which tasks block other tasks?
- Are there missing time estimates?
- Do priorities reflect the actual urgency?
- Should any complex tasks be broken down into SPECIFIC subtasks?

After using tools, provide your analysis as JSON:
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

      // Collect tool call results from all steps
      for (const step of result.steps) {
        if (step.toolResults) {
          for (const toolResult of step.toolResults) {
            actions.push({
              tool: toolResult.toolName,
              result: toolResult.output,
            });
            console.log(`[AIService] getAgenticProjectPlan - Tool called: ${toolResult.toolName}`);
          }
        }
      }

      // Parse the final text response as plan
      let plan: AIProjectPlan | null = null;
      try {
        const parsed = JSON.parse(stripMarkdownCodeBlock(result.text));
        plan = {
          ...parsed,
          schedule: parsed.schedule?.map(
            (s: { taskId: string; suggestedStart: string; suggestedEnd: string }) => ({
              taskId: s.taskId,
              suggestedStart: new Date(s.suggestedStart),
              suggestedEnd: new Date(s.suggestedEnd),
            })
          ) ?? [],
        } as AIProjectPlan;
      } catch {
        console.log(`[AIService] getAgenticProjectPlan - Could not parse plan JSON`);
      }

      console.log(`[AIService] getAgenticProjectPlan - Success! ${actions.length} actions taken (${Date.now() - startTime}ms)`);
      return { plan, actions };
    } catch (error) {
      console.error(`[AIService] getAgenticProjectPlan - Error (${Date.now() - startTime}ms):`, error);
      return { plan: null, actions };
    }
  }
}

// Singleton instance
export const aiService = new AIService();
