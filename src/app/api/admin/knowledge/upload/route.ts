import { setTimeout } from "node:timers/promises";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { embedMany } from "ai";
import { revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth/validate";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { knowledgeChunks } from "@/lib/db/schema";
import { CHAT_DOCUMENT_EMBEDDING_TASK, CHAT_EMBEDDING_MODEL_ID } from "@/lib/domain/policies";
import { type ParsedKnowledgeChunk, parseKnowledgeMarkdown } from "@/lib/knowledge/markdown";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
const EMBEDDING_BATCH_SIZE = 100;
const EMBEDDING_BATCH_DELAY_MS = 61_000;

function getEmbeddingModel() {
  const apiKey = process.env["GEMINI_API_KEY_PRIMARY"] ?? process.env["GEMINI_API_KEY"];
  if (!apiKey) {
    throw new Error("No Gemini API key configured for embedding");
  }
  return createGoogleGenerativeAI({ apiKey });
}

/**
 * POST /api/admin/knowledge/upload
 *
 * Accepts a .md file upload, parses it for diagnostic table data,
 * generates embeddings, and seeds the knowledge base.
 * Requires admin authentication.
 *
 * Form data:
 *   file - The .md file to upload
 *   clearExisting - "true" to clear existing chunks before importing (optional, default: true)
 */
export async function POST(request: Request): Promise<Response> {
  try {
    await requireAdmin();

    const formData = await request.formData();
    const fileEntry = formData.get("file");
    const clearExisting = formData.get("clearExisting") !== "false";

    if (!fileEntry || typeof fileEntry === "string") {
      return Response.json({ success: false, error: "No file uploaded" }, { status: 400 });
    }

    const file = fileEntry;

    // Validate file type — accept .md files
    const fileName = file.name?.toLowerCase() ?? "";
    if (!fileName.endsWith(".md")) {
      return Response.json(
        { success: false, error: "Only .md (Markdown) files are accepted" },
        { status: 400 },
      );
    }

    // Read file content
    const arrayBuffer = await file.arrayBuffer();
    const content = Buffer.from(arrayBuffer).toString("utf-8");

    if (!content.trim()) {
      return Response.json({ success: false, error: "File is empty" }, { status: 400 });
    }

    // Parse chunks from markdown
    const chunks = parseKnowledgeMarkdown(content);

    if (chunks.length === 0) {
      return Response.json(
        {
          success: false,
          error: "No Markdown tables found in the file.",
        },
        { status: 400 },
      );
    }

    // Generate every embedding before touching existing knowledge.
    const provider = getEmbeddingModel();
    let embeddings: number[][];
    try {
      embeddings = [];
      for (let index = 0; index < chunks.length; index += EMBEDDING_BATCH_SIZE) {
        const batch = chunks.slice(index, index + EMBEDDING_BATCH_SIZE);
        const result = await embedMany({
          model: provider.embedding(CHAT_EMBEDDING_MODEL_ID),
          values: batch.map((chunk) => chunk.content),
          providerOptions: { google: { taskType: CHAT_DOCUMENT_EMBEDDING_TASK } },
        });
        embeddings.push(...result.embeddings);
        if (index + EMBEDDING_BATCH_SIZE < chunks.length) {
          await setTimeout(EMBEDDING_BATCH_DELAY_MS);
        }
      }
    } catch (err) {
      console.error("Failed to generate knowledge embeddings:", err);
      return Response.json(
        {
          success: false,
          error: "Failed to generate embeddings. Existing knowledge was not changed.",
        },
        { status: 502 },
      );
    }

    if (embeddings.length !== chunks.length) {
      return Response.json(
        {
          success: false,
          error: "Embedding count mismatch. Existing knowledge was not changed.",
        },
        { status: 502 },
      );
    }

    const embeddedChunks: Array<ParsedKnowledgeChunk & { embedding: number[] }> = [];
    for (let index = 0; index < chunks.length; index++) {
      const chunk = chunks[index];
      const embedding = embeddings[index];
      if (!chunk || !embedding) {
        return Response.json(
          {
            success: false,
            error: "Embedding count mismatch. Existing knowledge was not changed.",
          },
          { status: 502 },
        );
      }
      embeddedChunks.push({ ...chunk, embedding });
    }

    await db.transaction(async (tx) => {
      if (clearExisting) {
        await tx.delete(knowledgeChunks);
      }
      await tx.insert(knowledgeChunks).values(embeddedChunks);
    });

    revalidateTag(CACHE_TAGS.KNOWLEDGE_CHUNKS, "max");

    return Response.json({
      success: true,
      count: embeddedChunks.length,
      failed: 0,
      total: chunks.length,
    });
  } catch (err) {
    console.error("Knowledge upload failed:", err);
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 },
    );
  }
}
