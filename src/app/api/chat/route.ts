import "server-only";

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// ── Types ──────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  brand?: string;
  errorCode?: string;
}

interface Provider {
  name: string;
  baseURL: string;
  apiKey: string;
  model: string;
}

// ── Provider Configuration ────────────────────────────────────────────────

function getProviders(): Provider[] {
  const providers: Provider[] = [];

  // OpenRouter — primary (brings together many models)
  const openRouterKey = process.env["OPENROUTER_API_KEY"];
  if (openRouterKey) {
    providers.push({
      name: "openrouter",
      baseURL: "https://openrouter.ai/api/v1/chat/completions",
      apiKey: openRouterKey,
      model: "google/gemma-3-4b-it",
    });
  }

  // Groq — fast inference
  const groqKey = process.env["GROQ_API_KEY"];
  if (groqKey) {
    providers.push({
      name: "groq",
      baseURL: "https://api.groq.com/openai/v1/chat/completions",
      apiKey: groqKey,
      model: "llama-3.3-70b-versatile",
    });
  }

  // Nvidia NIM
  const nvidiaKey = process.env["NVIDIA_API_KEY"];
  if (nvidiaKey) {
    providers.push({
      name: "nvidia",
      baseURL: "https://integrate.api.nvidia.com/v1/chat/completions",
      apiKey: nvidiaKey,
      model: "meta/llama-3.3-70b-instruct",
    });
  }

  // Gemini — fallback via OpenRouter-compatible endpoint
  const geminiKey = process.env["GEMINI_API_KEY_PRIMARY"];
  if (geminiKey) {
    providers.push({
      name: "gemini",
      baseURL:
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent",
      apiKey: geminiKey,
      model: "gemini-2.0-flash",
    });
  }

  return providers;
}

// ── Knowledge Loading ─────────────────────────────────────────────────────

const CONTENT_DIR = join(process.cwd(), "content");

async function loadKnowledgeContent(): Promise<string> {
  try {
    const entries = await readdir(CONTENT_DIR, { withFileTypes: true });
    const mdFiles = entries.filter(
      (entry) => entry.isFile() && (entry.name.endsWith(".md") || entry.name.endsWith(".txt")),
    );

    if (mdFiles.length === 0) {
      return "";
    }

    const contents = await Promise.all(
      mdFiles.map(async (file) => {
        const filePath = join(CONTENT_DIR, file.name);
        const raw = await readFile(filePath, "utf-8");
        return `<!-- ${file.name} -->\n${raw}`;
      }),
    );

    return contents.join("\n\n");
  } catch {
    // content/ directory does not exist or is unreadable
    return "";
  }
}

// ── System Prompt ─────────────────────────────────────────────────────────

function buildSystemPrompt(knowledge: string, brand?: string, errorCode?: string): string {
  const parts: string[] = [];

  parts.push(
    "You are a specialized BobSolar inverter diagnostic assistant. Your role is to help technicians diagnose and troubleshoot inverter fault codes.",
  );

  if (knowledge) {
    parts.push(
      "## Knowledge Base\nUse the following inverter diagnostic knowledge to answer questions accurately. Only use information from this knowledge base. If the knowledge base does not contain relevant information, politely state that you do not have information on this specific fault code.",
    );
    parts.push(knowledge);
  }

  parts.push("## Instructions");
  parts.push("1. Answer in Burmese by default unless the user asks in English.");
  parts.push(
    "2. For CRITICAL or MAJOR danger level faults, ALWAYS include a mandatory safety warning before troubleshooting steps.",
  );
  parts.push(
    "3. For communication errors (BMS, CAN, RS485, etc.), provide a structured diagnostic flow.",
  );
  parts.push(
    "4. If you do not have information about a specific fault code, say: 'I do not have information on this fault code in my current knowledge base.' Do NOT hallucinate.",
  );
  parts.push("5. Keep answers concise and actionable for field technicians.");

  if (brand) {
    parts.push(`\n## Current Context\nBrand: ${brand}`);
  }
  if (errorCode) {
    parts.push(`Error Code: ${errorCode}`);
  }

  return parts.join("\n\n");
}

// ── Validation ────────────────────────────────────────────────────────────

function validateRequest(
  body: unknown,
): { valid: true; data: ChatRequest } | { valid: false; error: string } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Invalid request body" };
  }

  const req = body as Record<string, unknown>;
  const messages = req["messages"];

  if (!Array.isArray(messages) || messages.length === 0) {
    return { valid: false, error: "At least one message is required" };
  }

  // Validate message structure
  for (const msg of messages) {
    if (!msg || typeof msg !== "object") {
      return { valid: false, error: "Invalid message format" };
    }
    const m = msg as Record<string, unknown>;
    if (m["role"] !== "user" && m["role"] !== "assistant") {
      return { valid: false, error: "Message role must be 'user' or 'assistant'" };
    }
    if (typeof m["content"] !== "string" || m["content"].length > 50000) {
      return { valid: false, error: "Message content must be a string under 50000 characters" };
    }
  }

  // Last message must be from user
  const lastMsg = messages[messages.length - 1] as Record<string, unknown>;
  if (lastMsg["role"] !== "user") {
    return { valid: false, error: "The final message must be from the user" };
  }

  return {
    valid: true,
    data: {
      messages: messages as ChatMessage[],
      ...(req["brand"] ? { brand: (req["brand"] as string).slice(0, 100) } : {}),
      ...(req["errorCode"] ? { errorCode: (req["errorCode"] as string).slice(0, 100) } : {}),
    },
  };
}

// ── Streaming Call ────────────────────────────────────────────────────────

async function callProvider(
  provider: Provider,
  systemPrompt: string,
  messages: ChatMessage[],
  signal: AbortSignal,
): Promise<Response> {
  const isGemini = provider.name === "gemini";

  if (isGemini) {
    // Gemini uses a different API format
    const geminiMessages = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const response = await fetch(`${provider.baseURL}?key=${provider.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: geminiMessages,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
      }),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`Gemini API error ${response.status}: ${errorText.slice(0, 200)}`);
    }

    // Convert Gemini streaming format to SSE
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body from Gemini");

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed?.startsWith("data: ")) continue;

              const jsonStr = trimmed.slice(6).trim();
              if (jsonStr === "[DONE]") continue;

              try {
                const parsed = JSON.parse(jsonStr);
                const text = parsed?.["candidates"]?.[0]?.["content"]?.["parts"]?.[0]?.["text"];
                if (text) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ delta: text })}\n\n`),
                  );
                }
              } catch {
                // skip malformed chunks
              }
            }
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-store",
        Connection: "keep-alive",
      },
    });
  }

  // OpenAI-compatible providers (OpenRouter, Groq, Nvidia)
  const response = await fetch(provider.baseURL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      stream: true,
      temperature: 0.7,
      max_tokens: 2048,
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`${provider.name} API error ${response.status}: ${errorText.slice(0, 200)}`);
  }

  return response;
}

// ── Route Handler ─────────────────────────────────────────────────────────

export const maxDuration = 30;

export async function POST(req: NextRequest): Promise<Response> {
  // Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate
  const result = validateRequest(body);
  if (!result.valid) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  const { messages, brand, errorCode } = result.data;

  // Load knowledge
  const knowledge = await loadKnowledgeContent();
  const systemPrompt = buildSystemPrompt(knowledge, brand, errorCode);

  // Get providers
  const providers = getProviders();
  if (providers.length === 0) {
    return NextResponse.json(
      { error: "No AI providers configured. Please set at least one API key." },
      { status: 503 },
    );
  }

  // Try providers in sequence
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  for (const provider of providers) {
    try {
      const response = await callProvider(provider, systemPrompt, messages, controller.signal);
      clearTimeout(timeout);
      return response;
    } catch (err) {
      console.warn(
        `[Chat] Provider "${provider.name}" failed:`,
        err instanceof Error ? err.message : String(err),
      );
      // Continue to next provider
    }
  }

  clearTimeout(timeout);
  return NextResponse.json(
    { error: "All AI providers are temporarily unavailable. Please try again shortly." },
    { status: 503 },
  );
}
