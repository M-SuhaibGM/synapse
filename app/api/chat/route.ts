import { anthropic, type AnthropicLanguageModelOptions } from "@ai-sdk/anthropic";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { getClientIp, rateLimit } from "@/lib/rateLimit";

// Streaming replies can take a while; let the function run up to 30s.
export const maxDuration = 30;

const RATE_LIMIT = 10; // requests…
const RATE_WINDOW_MS = 60_000; // …per minute, per IP
const MAX_MESSAGES = 20; // only the most recent turns are sent to the model
const MAX_CHARS = 1000; // per message

const SYSTEM_PROMPT = `You are "Ask Synapse", the assistant on the website of Synapse, an independent AI studio founded in 2024. Synapse makes thoughtful digital experiences for a world that won't sit still.

Services:
- AI experiences: intelligent products that feel intuitive, useful and human (product strategy, AI UX).
- Digital products: from first sketch to final pixel, turning ambitious ideas into useful tools (design, development).
- Creative technology: new ways to tell stories, connect systems and make the complex feel simple (prototyping, R&D).
- AI agents: assistants that research, decide and act inside the tools a team already uses (agents, automation).
- Knowledge & search: retrieval systems that ground every answer in a client's own documents and data (RAG, search).
- Immersive web: real-time 3D and motion that make a product impossible to scroll past (WebGL, motion).
Core disciplines: agents, RAG, full-stack development, 3D.

Contact: the contact section of this page, or hello@synapse.studio.

How to answer:
- Be warm, clear and brief: two to four sentences, plain text, no markdown, headings or lists.
- Only state facts given above. Do not invent prices, timelines, team members, clients or case studies. If asked, say these depend on the project and are best discussed on a call.
- When the visitor wants to start a project, asks about pricing, timelines or availability, or needs something you can't answer, suggest they book a call through the contact section and use the word "contact".
- Politely steer unrelated questions back to Synapse and its work.`;

// Keep only user/assistant text so a client can't inject system messages,
// tool calls or files, and cap the length of what reaches the model.
function sanitize(messages: unknown): UIMessage[] | null {
  if (!Array.isArray(messages) || messages.length === 0) return null;
  const clean: UIMessage[] = [];
  for (const message of messages.slice(-MAX_MESSAGES)) {
    const { id, role, parts } = (message ?? {}) as Partial<UIMessage>;
    if (role !== "user" && role !== "assistant") return null;
    if (!Array.isArray(parts)) return null;
    const text = parts
      .flatMap((part) => (part?.type === "text" && typeof part.text === "string" ? [part.text] : []))
      .join("")
      .slice(0, MAX_CHARS);
    if (!text.trim()) continue;
    clean.push({ id: String(id ?? clean.length), role, parts: [{ type: "text", text }] });
  }
  return clean.length > 0 && clean[clean.length - 1].role === "user" ? clean : null;
}

export async function POST(req: Request) {
  const limit = rateLimit(getClientIp(req.headers), RATE_LIMIT, RATE_WINDOW_MS);
  if (!limit.ok) {
    return new Response("You're sending messages quickly. Please wait a minute and try again.", {
      status: 429,
      headers: { "Retry-After": String(limit.retryAfter) },
    });
  }

  // The key is read here on the server only (no NEXT_PUBLIC_ prefix), so it never
  // reaches the browser bundle.
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set");
    return new Response("Chat is unavailable right now.", { status: 503 });
  }

  let body: { messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid request.", { status: 400 });
  }
  const messages = sanitize(body.messages);
  if (!messages) return new Response("Invalid request.", { status: 400 });

  const result = streamText({
    model: anthropic("claude-opus-5-5"),
    instructions: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    maxOutputTokens: 1024,
    abortSignal: req.signal,
    providerOptions: {
      anthropic: {
        // Short site-chat answers don't need deep reasoning.
        effort: "low",
        // If the model declines a request, the API retries it on a fallback model.
        fallbacks: "default",
      } satisfies AnthropicLanguageModelOptions,
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
