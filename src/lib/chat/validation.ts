import { z } from "zod";

export const knowledgeSearchInputSchema = z.object({
  query: z
    .string()
    .max(500)
    .optional()
    .describe("The problem description or diagnostic phrase to search for"),
  faultCode: z.string().max(100).optional().describe("The exact inverter fault code"),
  brand: z.string().max(100).optional().describe("The inverter or battery brand"),
});

export type KnowledgeSearchInput = z.infer<typeof knowledgeSearchInputSchema>;

const chatTextPartSchema = z.object({
  type: z.literal("text"),
  text: z.string().max(10_000),
});

const chatMessageSchema = z
  .object({
    id: z.string().max(100).optional(),
    role: z.enum(["user", "assistant"]),
    content: z.string().max(10_000).optional(),
    parts: z.array(chatTextPartSchema).max(20).optional(),
  })
  .refine(
    (message) =>
      (message.content?.trim().length ?? 0) > 0 ||
      message.parts?.some((part) => part.text.trim().length > 0) === true,
    "Message must contain text",
  );

/**
 * Request body schema for POST /api/chat.
 *
 * Validates and sanitises every field that arrives from the client
 * before it reaches the AI SDK.
 */
export const chatRequestSchema = z
  .object({
    messages: z
      .array(chatMessageSchema)
      .min(1, "At least one message is required")
      .max(100, "Too many messages in request"),
    brand: z.string().max(100).optional(),
    errorCode: z.string().max(100).optional(),
    conversationId: z.string().uuid().optional(),
  })
  .refine((request) => request.messages.at(-1)?.role === "user", {
    message: "The final message must be from the user",
    path: ["messages"],
  });

export type ChatRequestBody = z.infer<typeof chatRequestSchema>;

/**
 * Validate a raw request body against the chat request schema.
 * Returns the parsed body or throws a ZodError with details.
 */
export function validateChatRequest(body: unknown): ChatRequestBody {
  return chatRequestSchema.parse(body);
}
