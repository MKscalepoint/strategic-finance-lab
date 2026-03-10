import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { SYSTEM_PROMPT } from "@/lib/prompt";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  const { messages, questionLabel, question } = await req.json();

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response("ANTHROPIC_API_KEY not configured", { status: 500 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Prepend a system-level context message so the model knows which question is active
  const systemWithContext = `${SYSTEM_PROMPT}

## ACTIVE SESSION
The user has selected: "${questionLabel}" — ${question}
Begin by acknowledging this question briefly, then proceed immediately to Phase 0.`;

  const stream = await client.messages.stream({
    model: "claude-opus-4-5",
    max_tokens: 4096,
    system: systemWithContext,
    messages,
  });

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (
          chunk.type === "content_block_delta" &&
          chunk.delta.type === "text_delta"
        ) {
          controller.enqueue(encoder.encode(chunk.delta.text));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
