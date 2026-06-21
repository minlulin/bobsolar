import { z } from "zod";

/**
 * Request body schema for POST /api/chat.
 *
 * Validates and sanitises every field that arrives from the client
 * before it reaches the AI SDK.
 */
export const chatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().max(10_000).optional(),
        parts: z
          .array(
            z.object({
              type: z.literal("text"),
              text: z.string().max(10_000),
            }),
          )
          .max(20)
          .optional(),
      }),
    )
    .min(1, "At least one message is required")
    .max(100, "Too many messages in request"),
  brand: z.string().max(100).optional(),
  errorCode: z.string().max(100).optional(),
  conversationId: z.string().uuid().optional(),
});

export type ChatRequestBody = z.infer<typeof chatRequestSchema>;

/**
 * Validate a raw request body against the chat request schema.
 * Returns the parsed body or throws a ZodError with details.
 */
export function validateChatRequest(body: unknown): ChatRequestBody {
  return chatRequestSchema.parse(body);
}
