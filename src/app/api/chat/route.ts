import { google } from "@ai-sdk/google";
import { embed, streamText, tool } from "ai";
import { desc, sql } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/validate";
import { checkIpThrottle } from "@/lib/chat/ip-throttle";
import {
  recordChatCost,
  recordChatError,
  recordChatLatency,
  recordChatTokens,
} from "@/lib/chat/metrics";
import { calculateRequestCost, checkUserQuota } from "@/lib/chat/quota";
import { checkChatRateLimit } from "@/lib/chat/rate-limit";
import {
  createConversation,
  createSession,
  getConversation,
  logUsage,
  saveMessage,
  updateSessionActivity,
} from "@/lib/chat/sessions";
import { validateChatRequest } from "@/lib/chat/validation";
import { db } from "@/lib/db";
import { knowledgeChunks } from "@/lib/db/schema";
import {
  CHAT_DAILY_COST_ALERT_THRESHOLD_USD,
  CHAT_GLOBAL_COOLDOWN_MS,
} from "@/lib/domain/policies";
import { withCsrf } from "@/lib/security/csrf";

export const maxDuration = 30;

/**
 * Extract the client IP address from request headers.
 * Checks X-Forwarded-For first (for proxies), falls back to X-Real-IP,
 * then to a placeholder for direct connections.
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    // X-Forwarded-For can contain multiple IPs; the first is the client.
    const first = forwarded.split(",")[0];
    if (first) {
      return first.trim();
    }
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "unknown";
}

export const POST = withCsrf(async (req: Request) => {
  const startTime = Date.now();

  // ── 1. Authentication ─────────────────────────────────────────────
  let auth: Awaited<ReturnType<typeof requireAuth>>;
  try {
    auth = await requireAuth();
  } catch {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  // ── 2. IP-based throttle (abuse prevention) ───────────────────────
  const clientIp = getClientIp(req);
  const userAgent = req.headers.get("user-agent") ?? null;

  try {
    const ipThrottle = await checkIpThrottle(clientIp);
    if (!ipThrottle.allowed) {
      return Response.json(
        { error: "Too many requests from this IP. Please slow down." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(ipThrottle.retryAfterMs / 1000)),
          },
        },
      );
    }
  } catch (err) {
    console.error("[Chat API] IP throttle check error:", err);
    // Fail open: allow the request if the throttle check itself errors.
  }

  // ── 3. Per-user rate limiting ─────────────────────────────────────
  const rateLimit = await checkChatRateLimit(auth.userId);
  if (!rateLimit.allowed) {
    return Response.json(
      { error: "Rate limit exceeded. Please wait before sending more messages." },
      {
        status: 429,
        headers: {
          "X-RateLimit-Remaining": String(rateLimit.remaining),
          "X-RateLimit-Reset": rateLimit.resetAt.toISOString(),
          "Retry-After": String(Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000)),
        },
      },
    );
  }

  // ── 4. Token quota check ──────────────────────────────────────────
  try {
    const quota = await checkUserQuota(auth.userId);
    if (!quota.allowed) {
      return Response.json(
        {
          error:
            quota.reason === "daily_token_quota_exceeded"
              ? "Daily token quota exceeded. Please try again tomorrow."
              : "Monthly token quota exceeded. Please contact support.",
          reason: quota.reason,
          dailyCostUsd: quota.dailyCostUsd,
        },
        {
          status: 429,
          headers: {
            "X-Quota-Daily-Remaining": String(quota.dailyTokensRemaining),
            "X-Quota-Monthly-Remaining": String(quota.monthlyTokensRemaining),
            "Retry-After": String(
              quota.reason === "daily_token_quota_exceeded"
                ? Math.ceil(
                    (new Date(
                      new Date().getFullYear(),
                      new Date().getMonth(),
                      new Date().getDate() + 1,
                    ).getTime() -
                      Date.now()) /
                      1000,
                  )
                : CHAT_GLOBAL_COOLDOWN_MS / 1000,
            ),
          },
        },
      );
    }
  } catch (err) {
    console.error("[Chat API] Quota check error:", err);
    // Fail open: allow the request if the quota check itself errors.
  }

  // ── 5. Request validation ─────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let validated: ReturnType<typeof validateChatRequest>;
  try {
    validated = validateChatRequest(body);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: "Validation failed", details: err.issues }, { status: 422 });
    }
    throw err;
  }

  const { messages, brand, errorCode, conversationId } = validated;

  // ── 6. Session & conversation management ──────────────────────────
  let conversation: Awaited<ReturnType<typeof createConversation>>;
  let sessionId: string;

  try {
    if (conversationId) {
      const existing = await getConversation(conversationId, auth.userId);
      if (!existing) {
        return Response.json({ error: "Conversation not found" }, { status: 404 });
      }
      conversation = existing;
    } else {
      const firstContent = messages[0]?.content ?? "";
      conversation = await createConversation(auth.userId, {
        title: firstContent.slice(0, 80) || "New conversation",
        brand,
        lastErrorCode: errorCode,
      });
    }

    const session = await createSession(auth.userId, conversation.id);
    sessionId = session.id;
  } catch (err) {
    console.error("[Chat API] Session setup error:", err);
    return Response.json({ error: "Failed to initialize chat session" }, { status: 500 });
  }

  // ── 7. Save user message to DB ────────────────────────────────────
  const lastMessage = messages[messages.length - 1];
  const userContent =
    lastMessage?.content ?? lastMessage?.parts?.find((p) => p.type === "text")?.text ?? "";

  try {
    await saveMessage({
      conversationId: conversation.id,
      userId: auth.userId,
      role: "user",
      content: userContent,
      parts: lastMessage?.parts ?? null,
      parentMessageId: null,
      metadata: { brand, errorCode },
    });
  } catch (err) {
    console.error("[Chat API] Failed to save user message:", err);
  }

  // ── 8. Process the query with the AI SDK ──────────────────────────
  const systemPrompt = buildSystemPrompt(brand, errorCode);

  const sanitizedMessages = messages.map((m) => {
    if (!m.parts) {
      return { ...m, parts: [{ type: "text" as const, text: m.content || "" }] };
    }
    return m;
  });

  let result: Awaited<ReturnType<typeof streamText>>;
  try {
    // @ts-expect-error AI SDK streamText tool types are complex; validated at runtime via Zod
    result = await streamText({
      model: google("gemini-2.5-flash"),
      system: systemPrompt,
      messages: sanitizedMessages as Parameters<typeof streamText>[0]["messages"],
      tools: {
        searchKnowledgeBase: tool({
          description:
            "Search the inverter diagnostic knowledge base for specific error codes or technical documentation.",
          parameters: z.object({
            query: z
              .string()
              .max(500)
              .optional()
              .describe(
                "The error code or problem description to search for (e.g. 'F09', 'Fault 20', 'Islanding')",
              ),
            fault_code: z.string().max(100).optional().describe("The specific fault code"),
            brand: z
              .string()
              .max(100)
              .optional()
              .describe("The specific inverter brand if known (e.g. 'Growatt', 'Sungrow')"),
          }),
          // @ts-expect-error AI SDK tool execute type is complex; validated at runtime via Zod
          execute: async ({
            query,
            fault_code,
            brand: _toolBrand,
          }: {
            query?: string;
            fault_code?: string;
            brand?: string;
          }) => {
            const actualQuery = query || fault_code || "";
            if (!actualQuery) return { error: "No query provided" };
            try {
              const { embedding } = await embed({
                model: google.textEmbeddingModel("gemini-embedding-001"),
                value: actualQuery,
              });

              const embeddingString = JSON.stringify(embedding);
              const similarity = sql`1 - (${knowledgeChunks.embedding} <=> ${embeddingString})`;

              const results = await db
                .select({
                  content: knowledgeChunks.content,
                  similarity,
                })
                .from(knowledgeChunks)
                .orderBy((t) => desc(t.similarity))
                .limit(3);

              const validResults = results.filter((r) => Number(r.similarity) > 0.65);

              if (validResults.length === 0) {
                return {
                  results: [],
                  message: "No relevant error codes found in the knowledge base.",
                };
              }

              return {
                results: validResults.map((r) => r.content),
              };
            } catch (e) {
              console.error("[searchKnowledgeBase Error]", e);
              return { error: "Failed to search the knowledge base." };
            }
          },
        }),
      },
      onFinish: async ({ usage, finishReason }) => {
        const latencyMs = Date.now() - startTime;
        const cost = calculateRequestCost({
          promptTokens: usage?.inputTokens ?? null,
          completionTokens: usage?.outputTokens ?? null,
          totalTokens: usage?.totalTokens ?? null,
        });
        try {
          await logUsage({
            userId: auth.userId,
            sessionId,
            conversationId: conversation.id,
            messageId: null,
            model: "gemini-2.5-flash",
            promptTokens: usage?.inputTokens ?? null,
            completionTokens: usage?.outputTokens ?? null,
            totalTokens: usage?.totalTokens ?? null,
            costUsd: cost.totalCostUsd.toFixed(6),
            latencyMs,
            errorCode: finishReason === "error" ? "stream_error" : null,
            ipAddress: clientIp,
            userAgent,
          });

          // Log cost alert if threshold exceeded
          try {
            const quotaInfo = await checkUserQuota(auth.userId);
            if (quotaInfo.dailyCostUsd >= CHAT_DAILY_COST_ALERT_THRESHOLD_USD) {
              console.warn(
                `[Chat API Cost Alert] User ${auth.userId} daily cost $${quotaInfo.dailyCostUsd.toFixed(4)} exceeds threshold $${CHAT_DAILY_COST_ALERT_THRESHOLD_USD}`,
              );
            }
          } catch (quotaErr) {
            console.error("[Chat API] Cost alert check error:", quotaErr);
          }

          // Record metrics for monitoring dashboard
          recordChatTokens(usage?.inputTokens ?? 0, usage?.outputTokens ?? 0);
          recordChatCost(cost.totalCostUsd);
          recordChatLatency(latencyMs);
        } catch (logErr) {
          console.error("[Chat API] Failed to log usage:", logErr);
        }
      },
      onError: (error: unknown) => {
        console.error("[Chat API Stream Error]:", error);
        const latencyMs = Date.now() - startTime;
        recordChatError("stream_error");
        recordChatLatency(latencyMs);
        logUsage({
          userId: auth.userId,
          sessionId,
          conversationId: conversation.id,
          messageId: null,
          model: "gemini-2.5-flash",
          promptTokens: null,
          completionTokens: null,
          totalTokens: null,
          costUsd: null,
          latencyMs,
          errorCode: "stream_error",
          ipAddress: clientIp,
          userAgent,
        }).catch((logErr) => {
          console.error("[Chat API] Failed to log error usage:", logErr);
        });
      },
    });
  } catch (err) {
    console.error("[Chat API] streamText error:", err);
    return Response.json({ error: "Failed to process chat request" }, { status: 500 });
  }

  // ── 9. Update session activity ────────────────────────────────────
  try {
    await updateSessionActivity(sessionId);
  } catch (err) {
    console.error("[Chat API] Failed to update session activity:", err);
  }

  // ── 10. Return streaming response ─────────────────────────────────
  return result.toUIMessageStreamResponse({
    headers: {
      "X-Chat-Session-Id": sessionId,
      "X-Chat-Conversation-Id": conversation.id,
      "X-RateLimit-Remaining": String(rateLimit.remaining),
    },
    onError: (error: unknown) => {
      console.error("[Chat API Response Error]:", error);
      return String(error);
    },
  });
});

function buildSystemPrompt(brand?: string, errorCode?: string): string {
  return `You are a specialized BobSolar technician assistant chatbot.
Your primary role is to diagnose inverter fault codes using the provided knowledge base via the \`searchKnowledgeBase\` tool.

CURRENT SESSION CONTEXT:
- Brand: ${brand || "Not specified"}
- Last Error Code: ${errorCode || "Not specified"}

INSTRUCTIONS:
1. First, think step-by-step about the user's problem. Use the \`searchKnowledgeBase\` tool if the user asks about an error code or specific diagnostic information.
2. If the user asks for a fault code, YOU MUST CALL \`searchKnowledgeBase\` with the fault code and optionally the brand.
3. Apply BRAND-SPECIFIC ROUTING: If the user mentions or implies a brand (e.g., "Growatt", "Sungrow", "Huawei", "Deye", "GoodWe", "Felicity", "Voltronic", "Must Power"), use it in your search query.
4. CALIBRATED ABSTENTION: If the \`searchKnowledgeBase\` tool does NOT return relevant information for the error code requested, reply politely: 'I do not have information on this fault code in my current knowledge base.' and offer general diagnostic steps. DO NOT HALLUCINATE error codes or solutions.
5. If the user says a general greeting or asks a general question, greet them back and ask how you can help with inverter diagnostics. Do not use the tool for general greetings.
6. Answer in Burmese by default for the final response, unless requested in English.
7. For CRITICAL or MAJOR danger levels (based on tool results), ALWAYS include a mandatory safety warning before troubleshooting steps.
8. For communication errors (BMS, CAN, RS485, etc.), provide a structured diagnostic flow based on the tool result.`;
}
