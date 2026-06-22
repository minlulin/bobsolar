"use server";

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { embed } from "ai";
import { eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth/validate";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { knowledgeChunks } from "@/lib/db/schema";
import { CHAT_EMBEDDING_MODEL_ID } from "@/lib/domain/policies";
import { type ActionResponse, errorResponse, successResponse } from "@/lib/utils/action-response";
import { handleActionError } from "@/lib/utils/error";
import {
  type KnowledgeChunkInput,
  type KnowledgeChunkUpdateInput,
  knowledgeChunkSchema,
  knowledgeChunkUpdateSchema,
} from "@/lib/validators/knowledge";

function getEmbeddingModel() {
  const apiKey = process.env["GEMINI_API_KEY_PRIMARY"] ?? process.env["GEMINI_API_KEY"];
  if (!apiKey) {
    throw new Error("No Gemini API key configured for embedding");
  }
  return createGoogleGenerativeAI({ apiKey });
}

export async function getKnowledgeChunks(): Promise<
  ActionResponse<
    Array<{
      id: string;
      content: string;
      brand: string | null;
      errorCode: string | null;
      dangerLevel: string | null;
      category: string | null;
    }>
  >
> {
  try {
    await requireAdmin();

    const rows = await db
      .select({
        id: knowledgeChunks.id,
        content: knowledgeChunks.content,
        brand: knowledgeChunks.brand,
        errorCode: knowledgeChunks.errorCode,
        dangerLevel: knowledgeChunks.dangerLevel,
        category: knowledgeChunks.category,
      })
      .from(knowledgeChunks)
      .orderBy(knowledgeChunks.category);

    return successResponse(rows);
  } catch (err) {
    return handleActionError(err, "getKnowledgeChunks", "Failed to fetch knowledge chunks");
  }
}

export async function createKnowledgeChunk(
  input: KnowledgeChunkInput,
): Promise<ActionResponse<{ id: string }>> {
  try {
    await requireAdmin();

    const parsed = knowledgeChunkSchema.parse(input);

    // Generate embedding for the content
    const provider = getEmbeddingModel();
    const { embedding } = await embed({
      model: provider.textEmbeddingModel(CHAT_EMBEDDING_MODEL_ID),
      value: parsed.content,
    });

    const [row] = await db
      .insert(knowledgeChunks)
      .values({
        content: parsed.content,
        brand: parsed.brand || null,
        errorCode: parsed.errorCode || null,
        dangerLevel: parsed.dangerLevel || null,
        category: parsed.category || null,
        embedding,
      })
      .returning({ id: knowledgeChunks.id });

    if (!row) {
      return errorResponse("Failed to create knowledge chunk");
    }

    revalidateTag(CACHE_TAGS.KNOWLEDGE_CHUNKS, "max");

    return successResponse({ id: row.id });
  } catch (err) {
    return handleActionError(err, "createKnowledgeChunk", "Failed to create knowledge chunk");
  }
}

export async function updateKnowledgeChunk(
  input: KnowledgeChunkUpdateInput,
): Promise<ActionResponse<{ id: string }>> {
  try {
    await requireAdmin();

    const parsed = knowledgeChunkUpdateSchema.parse(input);

    // Regenerate embedding since content may have changed
    const provider = getEmbeddingModel();
    const { embedding } = await embed({
      model: provider.textEmbeddingModel(CHAT_EMBEDDING_MODEL_ID),
      value: parsed.content,
    });

    const [row] = await db
      .update(knowledgeChunks)
      .set({
        content: parsed.content,
        brand: parsed.brand || null,
        errorCode: parsed.errorCode || null,
        dangerLevel: parsed.dangerLevel || null,
        category: parsed.category || null,
        embedding,
      })
      .where(eq(knowledgeChunks.id, parsed.id))
      .returning({ id: knowledgeChunks.id });

    if (!row) {
      return errorResponse("Knowledge chunk not found");
    }

    revalidateTag(CACHE_TAGS.KNOWLEDGE_CHUNKS, "max");

    return successResponse({ id: row.id });
  } catch (err) {
    return handleActionError(err, "updateKnowledgeChunk", "Failed to update knowledge chunk");
  }
}

export async function deleteKnowledgeChunk(id: string): Promise<ActionResponse<{ id: string }>> {
  try {
    await requireAdmin();

    if (!id || typeof id !== "string") {
      return errorResponse("Invalid chunk ID");
    }

    const [deleted] = await db
      .delete(knowledgeChunks)
      .where(eq(knowledgeChunks.id, id))
      .returning({ id: knowledgeChunks.id });

    if (!deleted) {
      return errorResponse("Knowledge chunk not found");
    }

    revalidateTag(CACHE_TAGS.KNOWLEDGE_CHUNKS, "max");

    return successResponse({ id: deleted.id });
  } catch (err) {
    return handleActionError(err, "deleteKnowledgeChunk", "Failed to delete knowledge chunk");
  }
}
