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

const textPartSchema = z.object({
  type: z.literal("text"),
  text: z.string().max(50000),
  state: z.enum(["streaming", "done"]).optional(),
});

const reasoningPartSchema = z.object({
  type: z.literal("reasoning"),
  text: z.string().max(50000),
  state: z.enum(["streaming", "done"]).optional(),
});

const stepStartPartSchema = z.object({
  type: z.literal("step-start"),
});

const sourceUrlPartSchema = z.object({
  type: z.literal("source-url"),
  sourceId: z.string().max(200),
  url: z.string().max(2000),
  title: z.string().max(500).optional(),
});

const sourceDocumentPartSchema = z.object({
  type: z.literal("source-document"),
  sourceId: z.string().max(200),
  mediaType: z.string().max(100),
  title: z.string().max(500),
  filename: z.string().max(200).optional(),
});

const filePartSchema = z.object({
  type: z.literal("file"),
  mediaType: z.string().max(100),
  url: z.string().max(5000),
  filename: z.string().max(200).optional(),
});

const toolPartSchema = z
  .object({
    type: z.string().regex(/^tool-.+$/),
    toolCallId: z.string().max(200),
    state: z.string().max(50).optional(),
    input: z.unknown().optional(),
    output: z.unknown().optional(),
    errorText: z.string().max(5000).optional(),
    title: z.string().max(500).optional(),
  })
  .passthrough();

const dynamicToolPartSchema = z
  .object({
    type: z.literal("dynamic-tool"),
    toolName: z.string().max(200),
    toolCallId: z.string().max(200),
    state: z.string().max(50).optional(),
    input: z.unknown().optional(),
    output: z.unknown().optional(),
    errorText: z.string().max(5000).optional(),
  })
  .passthrough();

const dataPartSchema = z
  .object({
    type: z.string().regex(/^data-.+$/),
    id: z.string().max(200).optional(),
    data: z.unknown(),
  })
  .passthrough();

const uiMessagePartSchema = z.union([
  textPartSchema,
  reasoningPartSchema,
  stepStartPartSchema,
  sourceUrlPartSchema,
  sourceDocumentPartSchema,
  filePartSchema,
  toolPartSchema,
  dynamicToolPartSchema,
  dataPartSchema,
]);

const chatMessageSchema = z
  .object({
    id: z.string().max(100).optional(),
    role: z.enum(["user", "assistant", "data", "tool"]),
    content: z.string().max(50000).optional(),
    parts: z.array(uiMessagePartSchema).max(100).optional(),
    toolInvocations: z.any().optional(),
    annotations: z.any().optional(),
  })
  .passthrough();

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
