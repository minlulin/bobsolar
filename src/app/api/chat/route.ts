import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { convertToModelMessages, embed, stepCountIs, streamText, tool, type UIMessage } from "ai";
import { and, desc, ilike, sql } from "drizzle-orm";
import { z } from "zod";
import { requireChatAccess } from "@/lib/auth/validate";
import { checkIpThrottle } from "@/lib/chat/ip-throttle";
import {
  getKeyCount,
  getNextKey,
  isQuotaError,
  reportKeyFailure,
  reportKeySuccess,
} from "@/lib/chat/key-rotator";
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
  getConversation,
  getOrCreateSession,
  logUsage,
  saveMessage,
  updateSessionActivity,
} from "@/lib/chat/sessions";
import { knowledgeSearchInputSchema, validateChatRequest } from "@/lib/chat/validation";
import { db } from "@/lib/db";
import { knowledgeChunks } from "@/lib/db/schema";
import {
  CHAT_DAILY_COST_ALERT_THRESHOLD_USD,
  CHAT_EMBEDDING_MODEL_ID,
  CHAT_GLOBAL_COOLDOWN_MS,
  CHAT_KNOWLEDGE_RESULT_LIMIT,
  CHAT_KNOWLEDGE_SIMILARITY_THRESHOLD,
  CHAT_MAX_COMPLETION_TOKENS_PER_REQUEST,
  CHAT_MAX_TOOL_STEPS,
  CHAT_MODEL_ID,
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

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function getMessageText(message: Pick<UIMessage, "parts">): string {
  return message.parts
    .filter(
      (part): part is Extract<(typeof message.parts)[number], { type: "text" }> =>
        part.type === "text",
    )
    .map((part) => part.text)
    .join("")
    .trim();
}

export const POST = withCsrf(async (req: Request) => {
  const startTime = Date.now();

  // ── 1. Authentication ─────────────────────────────────────────────
  let auth: Awaited<ReturnType<typeof requireChatAccess>>;
  try {
    auth = await requireChatAccess();
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
    return Response.json({ error: "Chat service is temporarily unavailable" }, { status: 503 });
  }

  // ── 3. Per-user rate limiting ─────────────────────────────────────
  let rateLimit: Awaited<ReturnType<typeof checkChatRateLimit>>;
  try {
    rateLimit = await checkChatRateLimit(auth.userId);
  } catch (err) {
    console.error("[Chat API] Rate-limit check error:", err);
    return Response.json({ error: "Chat service is temporarily unavailable" }, { status: 503 });
  }
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
    return Response.json({ error: "Chat service is temporarily unavailable" }, { status: 503 });
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

  // ── 6. Normalize UI messages before any persistence ───────────────
  const uiMessages: UIMessage[] = messages.map((message, index) => ({
    id: message.id ?? `server-${index}`,
    role: message.role,
    parts: message.parts ?? [{ type: "text", text: message.content ?? "" }],
  }));

  let modelMessages: Awaited<ReturnType<typeof convertToModelMessages>>;
  try {
    modelMessages = await convertToModelMessages(uiMessages);
  } catch (conversionError) {
    console.error("[Chat API] Message conversion error:", conversionError);
    return Response.json({ error: "Invalid message format. Please try again." }, { status: 400 });
  }

  // ── 7. Session & conversation management ──────────────────────────
  let conversation: Awaited<ReturnType<typeof createConversation>>;
  let sessionId: string;

  try {
    if (conversationId) {
      const existing = await getConversation(conversationId, auth.userId);
      conversation =
        existing ??
        (await createConversation(auth.userId, {
          id: conversationId,
          title:
            getMessageText(uiMessages[0] ?? uiMessages.at(-1) ?? { parts: [] }).slice(0, 80) ||
            "New conversation",
          brand,
          lastErrorCode: errorCode,
        }));
    } else {
      const firstContent = uiMessages[0] ? getMessageText(uiMessages[0]) : "";
      conversation = await createConversation(auth.userId, {
        title: firstContent.slice(0, 80) || "New conversation",
        brand,
        lastErrorCode: errorCode,
      });
    }

    const session = await getOrCreateSession(auth.userId, conversation.id);
    sessionId = session.id;
  } catch (err) {
    console.error("[Chat API] Session setup error:", err);
    return Response.json({ error: "Failed to initialize chat session" }, { status: 500 });
  }

  // ── 8. Save user message to DB ────────────────────────────────────
  const lastMessage = uiMessages.at(-1);
  const userContent = lastMessage ? getMessageText(lastMessage) : "";

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

  // ── 9. Process the query with the AI SDK ──────────────────────────
  const systemPrompt = buildSystemPrompt(brand, errorCode);
  const keyInfo = getNextKey();
  if (!keyInfo) {
    console.error(
      `[Chat API] All ${getKeyCount()} Gemini API keys are on cooldown. Retry after ${CHAT_GLOBAL_COOLDOWN_MS / 1000}s.`,
    );
    return Response.json(
      {
        error: "All API keys are temporarily rate-limited. Please try again shortly.",
        retryAfterMs: CHAT_GLOBAL_COOLDOWN_MS,
      },
      {
        status: 503,
        headers: { "Retry-After": String(Math.ceil(CHAT_GLOBAL_COOLDOWN_MS / 1000)) },
      },
    );
  }

  const googleProvider = createGoogleGenerativeAI({ apiKey: keyInfo.key });

  const result = await (async () => {
    try {
      return await streamText({
        model: googleProvider(CHAT_MODEL_ID),
        system: systemPrompt,
        messages: modelMessages,
        maxOutputTokens: CHAT_MAX_COMPLETION_TOKENS_PER_REQUEST,
        stopWhen: stepCountIs(CHAT_MAX_TOOL_STEPS),
        tools: {
          searchKnowledgeBase: tool({
            description:
              "Search the inverter diagnostic knowledge base. Supply the brand and exact fault code whenever the user provides them.",
            inputSchema: knowledgeSearchInputSchema,
            execute: async ({ query, faultCode, brand: toolBrand }) => {
              const actualQuery = [toolBrand, faultCode, query].filter(Boolean).join(" ").trim();
              if (!actualQuery) return { error: "No query provided" };
              try {
                const { embedding } = await embed({
                  model: googleProvider.textEmbeddingModel(CHAT_EMBEDDING_MODEL_ID),
                  value: actualQuery,
                });

                const embeddingString = JSON.stringify(embedding);
                const similarity = sql`1 - (${knowledgeChunks.embedding} <=> ${embeddingString})`;
                const filters = [];
                if (toolBrand) {
                  filters.push(
                    ilike(knowledgeChunks.brand, `%${escapeLikePattern(toolBrand.trim())}%`),
                  );
                }
                if (faultCode) {
                  filters.push(
                    ilike(knowledgeChunks.errorCode, `%${escapeLikePattern(faultCode.trim())}%`),
                  );
                }

                const results = await db
                  .select({
                    content: knowledgeChunks.content,
                    brand: knowledgeChunks.brand,
                    errorCode: knowledgeChunks.errorCode,
                    dangerLevel: knowledgeChunks.dangerLevel,
                    category: knowledgeChunks.category,
                    similarity,
                  })
                  .from(knowledgeChunks)
                  .where(filters.length > 0 ? and(...filters) : sql`true`)
                  .orderBy((t) => desc(t.similarity))
                  .limit(CHAT_KNOWLEDGE_RESULT_LIMIT);

                const validResults = results.filter(
                  (row) => Number(row.similarity) >= CHAT_KNOWLEDGE_SIMILARITY_THRESHOLD,
                );

                if (validResults.length === 0) {
                  return {
                    results: [],
                    message: "No relevant error codes found in the knowledge base.",
                  };
                }

                return {
                  results: validResults.map((row) => ({
                    brand: row.brand,
                    errorCode: row.errorCode,
                    dangerLevel: row.dangerLevel,
                    category: row.category,
                    content: row.content,
                  })),
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
              model: `${CHAT_MODEL_ID} (${keyInfo.label})`,
              promptTokens: usage?.inputTokens ?? null,
              completionTokens: usage?.outputTokens ?? null,
              totalTokens: usage?.totalTokens ?? null,
              costUsd: cost.totalCostUsd.toFixed(6),
              latencyMs,
              errorCode: finishReason === "error" ? "stream_error" : null,
              ipAddress: clientIp,
              userAgent,
            });

            if (finishReason !== "error") {
              reportKeySuccess(keyInfo.key);
            }

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
        onError: ({ error }: { error: unknown }) => {
          console.error("[Chat API Stream Error]:", error);
          const latencyMs = Date.now() - startTime;
          recordChatError("stream_error");
          recordChatLatency(latencyMs);

          // Report key failure for quota errors
          if (isQuotaError(error)) {
            reportKeyFailure(keyInfo.key);
          }

          logUsage({
            userId: auth.userId,
            sessionId,
            conversationId: conversation.id,
            messageId: null,
            model: `${CHAT_MODEL_ID} (${keyInfo.label})`,
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
      console.error("[Chat API] Failed to initialize model stream:", err);
      if (isQuotaError(err)) {
        reportKeyFailure(keyInfo.key);
      }
      return null;
    }
  })();

  if (!result) {
    return Response.json({ error: "Failed to process chat request" }, { status: 500 });
  }

  // ── 10. Update session activity ───────────────────────────────────
  try {
    await updateSessionActivity(sessionId);
  } catch (err) {
    console.error("[Chat API] Failed to update session activity:", err);
  }

  // ── 11. Return streaming response ─────────────────────────────────
  return result.toUIMessageStreamResponse({
    originalMessages: uiMessages,
    headers: {
      "X-Chat-Session-Id": sessionId,
      "X-Chat-Conversation-Id": conversation.id,
      "X-RateLimit-Remaining": String(rateLimit.remaining),
    },
    onFinish: async ({ responseMessage }) => {
      const assistantContent = getMessageText(responseMessage);
      if (!assistantContent) return;
      try {
        await saveMessage({
          conversationId: conversation.id,
          userId: auth.userId,
          role: "assistant",
          content: assistantContent,
          parts: responseMessage.parts,
          parentMessageId: null,
          metadata: { brand, errorCode },
        });
      } catch (err) {
        console.error("[Chat API] Failed to save assistant message:", err);
      }
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
2. If the user asks for a fault code, YOU MUST CALL \`searchKnowledgeBase\` with the exact fault code and brand when known.
3. Apply BRAND-SPECIFIC ROUTING: If the user mentions or implies a brand (e.g., "Growatt", "Sungrow", "Huawei", "Deye", "GoodWe", "Felicity", "Voltronic", "Must Power"), use it in your search query.
4. CALIBRATED ABSTENTION: If the \`searchKnowledgeBase\` tool does NOT return relevant information for the error code requested, reply politely: 'I do not have information on this fault code in my current knowledge base.' and offer general diagnostic steps. DO NOT HALLUCINATE error codes or solutions.
5. If the user says a general greeting or asks a general question, greet them back and ask how you can help with inverter diagnostics. Do not use the tool for general greetings.
6. Answer in Burmese by default for the final response, unless requested in English.
7. Read the tool's structured \`dangerLevel\`. For CRITICAL or MAJOR results, ALWAYS include a mandatory safety warning before troubleshooting steps.
8. For communication errors (BMS, CAN, RS485, etc.), provide a structured diagnostic flow based on the tool result.`;
}
