import { google } from "@ai-sdk/google";
import { embed, streamText, tool } from "ai";
import { desc, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { knowledgeChunks } from "@/lib/db/schema";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// Schema for chat session
const ChatSessionSchema = z.object({
  id: z.string(),
  userId: z.string().optional(),
  brand: z.string().optional(),
  lastErrorCode: z.string().optional(),
  context: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

type ChatSession = z.infer<typeof ChatSessionSchema>;

export async function POST(req: Request) {
  const { messages, brand, errorCode, userId } = await req.json();

  console.log("INCOMING MESSAGES FROM UI:");
  console.log(JSON.stringify(messages, null, 2));

  // Create or update chat session
  const session = await createOrUpdateSession(userId, brand, errorCode);

  // Process the query with context
  const result = await processQuery(messages, session, brand, errorCode);

  // Update session with new context
  await updateSession(session.id, {
    lastErrorCode: errorCode,
    context: {
      ...session.context,
      lastQuery: messages[messages.length - 1]?.content,
      timestamp: new Date(),
    },
  });

  return result.toUIMessageStreamResponse({
    onError: (error) => {
      console.error("[Chat API Error]:", error);
      return String(error);
    },
  });
}

async function createOrUpdateSession(userId?: string, brand?: string, errorCode?: string) {
  // Create or retrieve chat session with context
  // In production, this would use a database

  const sessionId = userId ? `session_${userId}` : `session_${Date.now()}`;

  return {
    id: sessionId,
    userId,
    brand,
    lastErrorCode: errorCode,
    context: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

async function updateSession(
  sessionId: string,
  updates: Partial<z.infer<typeof ChatSessionSchema>>,
) {
  // Update session in database
  // In production, this would use a database
  console.log(`[Chat API] Updating session ${sessionId}:`, updates);
}

async function processQuery(
  messages: Parameters<typeof streamText>[0]["messages"],
  session: ChatSession,
  brand?: string,
  errorCode?: string,
) {
  const systemPrompt = `You are a specialized BobSolar technician assistant chatbot.
Your primary role is to diagnose inverter fault codes using the provided knowledge base via the \`searchKnowledgeBase\` tool.

CURRENT SESSION CONTEXT:
- Brand: ${brand || session.brand || "Not specified"}
- Last Error Code: ${errorCode || session.lastErrorCode || "Not specified"}
- User Context: ${JSON.stringify(session.context, null, 2)}

INSTRUCTIONS:
1. First, think step-by-step about the user's problem. Use the \`searchKnowledgeBase\` tool if the user asks about an error code or specific diagnostic information.
2. If the user asks for a fault code, YOU MUST CALL \`searchKnowledgeBase\` with the fault code and optionally the brand.
3. Apply BRAND-SPECIFIC ROUTING: If the user mentions or implies a brand (e.g., "Growatt", "Sungrow", "Huawei", "Deye", "GoodWe", "Felicity", "Voltronic", "Must Power"), use it in your search query.
4. CALIBRATED ABSTENTION: If the \`searchKnowledgeBase\` tool does NOT return relevant information for the error code requested, reply politely: 'I do not have information on this fault code in my current knowledge base.' and offer general diagnostic steps. DO NOT HALLUCINATE error codes or solutions.
5. If the user says a general greeting or asks a general question, greet them back and ask how you can help with inverter diagnostics. Do not use the tool for general greetings.
6. Answer in Burmese by default for the final response, unless requested in English.
7. For CRITICAL or MAJOR danger levels (based on tool results), ALWAYS include a mandatory safety warning before troubleshooting steps.
8. For communication errors (BMS, CAN, RS485, etc.), provide a structured diagnostic flow based on the tool result.`;

  // biome-ignore lint/suspicious/noExplicitAny: legacy message format support
  const sanitizedMessages = (messages || []).map((m: any) => {
    if (!m.parts) {
      m.parts = [{ type: "text", text: m.content || m.text || "" }];
    }
    return m;
  });

  const result = await streamText({
    model: google("gemini-2.5-flash"),
    system: systemPrompt,
    messages: sanitizedMessages,
    tools: {
      searchKnowledgeBase: tool({
        description:
          "Search the inverter diagnostic knowledge base for specific error codes or technical documentation.",
        parameters: z.object({
          query: z
            .string()
            .optional()
            .describe(
              "The error code or problem description to search for (e.g. 'F09', 'Fault 20', 'Islanding')",
            ),
          fault_code: z.string().optional().describe("The specific fault code"),
          brand: z
            .string()
            .optional()
            .describe("The specific inverter brand if known (e.g. 'Growatt', 'Sungrow')"),
        }),
        // @ts-expect-error
        execute: async ({
          query,
          fault_code,
          brand,
        }: {
          query?: string;
          fault_code?: string;
          brand?: string;
        }) => {
          const actualQuery = query || fault_code || "";
          if (!actualQuery) return { error: "No query provided" };
          console.log(
            `[Tool] searchKnowledgeBase called with query: ${actualQuery}, brand: ${brand}`,
          );
          try {
            // Generate embedding for the query
            const { embedding } = await embed({
              model: google.textEmbeddingModel("gemini-embedding-001"),
              value: actualQuery,
            });

            // Perform vector search
            const embeddingString = JSON.stringify(embedding);
            const similarity = sql`1 - (${knowledgeChunks.embedding} <=> ${embeddingString})`;

            const queryBuilder = db
              .select({
                content: knowledgeChunks.content,
                similarity,
              })
              .from(knowledgeChunks);

            // Fetch top 3 matches
            const results = await queryBuilder.orderBy((t) => desc(t.similarity)).limit(3);

            // Filter out poor matches (e.g. similarity < 0.6) depending on the model characteristics
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
    // We rely on the frontend useChat to handle tool roundtrips
  });

  return result;
}
