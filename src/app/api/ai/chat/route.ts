import { streamText, convertToModelMessages, smoothStream, stepCountIs, type UIMessage } from "ai";
import { google } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { headers } from "next/headers";
import { env } from "~/env";
import { auth } from "~/lib/auth";
import { checkRateLimit, AI_RATE_LIMITS } from "~/server/services/rate-limiter";
import { db } from "~/server/db";
import { createChatTools } from "~/server/services/ai-tools";

export const runtime = "nodejs";

// Groq with Llama 3.3 70B - excellent free tier limits (30 RPM, 14,400 RPD)
const groq = env.GROQ_API_KEY ? createGroq({ apiKey: env.GROQ_API_KEY }) : null;

// Fallback: Gemini 2.5 Flash
const gemini = env.GOOGLE_GENERATIVE_AI_API_KEY ? google("gemini-2.5-flash") : null;

function getPrimaryModel() {
  if (groq) return groq("llama-3.3-70b-versatile");
  return gemini;
}

function getFallbackModel() {
  return gemini;
}

function isRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { status?: number; statusCode?: number; message?: string };
  return e.status === 429 || e.statusCode === 429 || (typeof e.message === "string" && e.message.includes("429"));
}

interface ChatRequest {
  messages: UIMessage[];
  timezone?: string;
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

  const primaryModel = getPrimaryModel();
  if (!primaryModel) {
    return new Response(JSON.stringify({ error: "AI not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { messages, taskContext, timezone } = (await req.json()) as ChatRequest;

    // Fetch projects for tool context (single-user app, no user filter needed)
    const projects = await db.project.findMany({
      select: { id: true, name: true },
      orderBy: { createdAt: "desc" },
    });

    const tools = createChatTools(session.user.id, projects);

    const projectsContext = projects.length > 0
      ? `\n\nUser's projects: ${projects.map((p) => `"${p.name}" (id: ${p.id})`).join(", ")}`
      : "";

    const now = new Date();
    // Validate timezone to prevent injection
    const tz = (() => {
      try {
        if (timezone) Intl.DateTimeFormat(undefined, { timeZone: timezone });
        return timezone ?? "UTC";
      } catch {
        return "UTC";
      }
    })();
    const today = now.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: tz,
    }); // e.g. "Wednesday, April 9, 2026"
    // Get offset string like "+03:00" so model generates correct ISO dates
    const tzOffset =
      new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" })
        .formatToParts(now)
        .find((p) => p.type === "timeZoneName")
        ?.value?.replace("GMT", "") ?? "+00:00";

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
      : `You are a productivity assistant helping with task management, goal setting, and learning.

Today's date: ${today} (timezone: ${tz}, UTC offset: ${tzOffset})

IMPORTANT: When generating dates for scheduling, always include the UTC offset in ISO 8601 format: \`YYYY-MM-DDTHH:MM:SS${tzOffset}\`. Never use bare ISO strings without an offset.

Your role:
1. Help break down goals into actionable tasks
2. Suggest learning resources and approaches
3. Provide guidance on prioritization and scheduling
4. Offer practical tips for completing tasks efficiently
5. Create tasks directly when the user asks you to${projectsContext}

When creating tasks, always confirm what you created. If the user mentions a deadline or specific time, include it so the task syncs to Google Calendar automatically.

IMPORTANT: After calling any tool, you MUST always respond with a brief text message confirming what was done. Never end your turn with only a tool call.

Be concise, practical, and encouraging.`;

    const streamArgs = {
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      tools,
      stopWhen: stepCountIs(3),
      experimental_transform: smoothStream({ delayInMs: 25, chunking: "word" }),
    };

    try {
      const result = streamText({ model: primaryModel, ...streamArgs });
      return result.toUIMessageStreamResponse();
    } catch (primaryError) {
      // Fall back to Gemini if Groq is rate limited
      const fallback = getFallbackModel();
      if (fallback && fallback !== primaryModel && isRateLimitError(primaryError)) {
        console.warn("[AI Chat] Primary model rate limited, falling back to Gemini");
        const result = streamText({ model: fallback, ...streamArgs });
        return result.toUIMessageStreamResponse();
      }
      throw primaryError;
    }
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
