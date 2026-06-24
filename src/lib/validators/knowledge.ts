import { z } from "zod";

export const knowledgeChunkSchema = z.object({
  content: z
    .string()
    .min(10, "Content must be at least 10 characters")
    .max(10_000, "Content must be under 10,000 characters"),
  brand: z.string().max(100, "Brand name too long").optional().default(""),
  model: z.string().max(200, "Model name too long").optional().default(""),
  capacity: z.string().max(100, "Capacity too long").optional().default(""),
  errorCode: z.string().max(100, "Error code too long").optional().default(""),
  dangerLevel: z.string().max(50, "Danger level too long").optional().default(""),
  category: z.string().max(200, "Category too long").optional().default(""),
});

export type KnowledgeChunkInput = z.infer<typeof knowledgeChunkSchema>;

export const knowledgeChunkUpdateSchema = knowledgeChunkSchema.extend({
  id: z.string().uuid("Invalid chunk ID"),
});

export type KnowledgeChunkUpdateInput = z.infer<typeof knowledgeChunkUpdateSchema>;
