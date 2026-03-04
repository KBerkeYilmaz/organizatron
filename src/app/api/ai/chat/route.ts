import { streamText, convertToModelMessages, smoothStream, type UIMessage } from "ai";
import { google } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { headers } from "next/headers";
import { env } from "~/env";
import { auth } from "~/lib/auth";
import { checkRateLimit, AI_RATE_LIMITS } from "~/server/services/rate-limiter";

export const runtime = "nodejs";

// Groq with Llama 3.3 70B - excellent free tier limits (30 RPM, 14,400 RPD)
const groq = env.GROQ_API_KEY ? createGroq({ apiKey: env.GROQ_API_KEY }) : null;

// Fallback to Gemini if Groq not configured
const gemini = env.GOOGLE_GENERATIVE_AI_API_KEY ? google("gemini-2.5-flash") : null;

// Get the best available model
function getModel() {
  if (groq) return groq("llama-3.3-70b-versatile");
  if (gemini) return gemini;
  return null;
}

interface ChatRequest {
  messages: UIMessage[];
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
  // Authentication check
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Rate limiting
  const rateLimitResult = checkRateLimit(
    `chat:${session.user.id}`,
    AI_RATE_LIMITS.chat
  );

  if (!rateLimitResult.allowed) {
    const retryAfter = Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000);
    return new Response(
      JSON.stringify({
        error: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfter),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(rateLimitResult.resetAt),
        },
      }
    );
  }

  const model = getModel();
  if (!model) {
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
      model,
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      // Smooth out streaming for better UX - natural typing effect
      experimental_transform: smoothStream({
        delayInMs: 25,
        chunking: "word",
      }),
    });

    return result.toUIMessageStreamResponse();
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
