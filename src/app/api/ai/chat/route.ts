import { streamText } from "ai";
import { google } from "@ai-sdk/google";
import { env } from "~/env";

export const runtime = "nodejs";

interface ChatRequest {
  messages: { role: "user" | "assistant"; content: string }[];
  taskContext?: {
    id: string;
    title: string;
    description?: string;
    projectName: string;
    priority: string;
    tags: string[];
  };
}

export async function POST(req: Request) {
  if (!env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return new Response(JSON.stringify({ error: "AI not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { messages, taskContext } = (await req.json()) as ChatRequest;

    const systemPrompt = taskContext
      ? `You are a productivity coach helping with task management and learning.

Current task context:
- Task: "${taskContext.title}"
${taskContext.description ? `- Description: ${taskContext.description}` : ""}
- Project: ${taskContext.projectName}
- Priority: ${taskContext.priority}
- Tags: ${taskContext.tags.join(", ") || "none"}

Your role:
1. Provide actionable guidance for completing the task
2. Suggest learning resources (articles, videos, documentation)
3. Break down complex tasks into smaller steps
4. Offer prompts the user can use with AI coding assistants like Claude Code
5. Help with time estimation and scheduling

Be concise, practical, and encouraging. Focus on helping the user make progress.`
      : `You are a productivity coach helping with task management, goal setting, and learning.

Your role:
1. Help break down goals into actionable tasks
2. Suggest learning resources and approaches
3. Provide guidance on prioritization and scheduling
4. Offer practical tips for completing tasks efficiently

Be concise, practical, and encouraging.`;

    const result = streamText({
      // Using Gemini 2.5 Flash - best price-performance ratio
      model: google("gemini-2.5-flash"),
      system: systemPrompt,
      messages,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("[AI Chat] Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process request" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
