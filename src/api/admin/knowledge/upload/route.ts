import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { embed } from "ai";
import { revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth/validate";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { knowledgeChunks } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

interface ParsedChunk {
  content: string;
  brand: string | null;
  errorCode: string | null;
  dangerLevel: string | null;
  category: string;
}

function getEmbeddingModel() {
  const apiKey = process.env["GEMINI_API_KEY_PRIMARY"] ?? process.env["GEMINI_API_KEY"];
  if (!apiKey) {
    throw new Error("No Gemini API key configured for embedding");
  }
  return createGoogleGenerativeAI({ apiKey });
}

/**
 * Parse markdown content into structured knowledge chunks.
 * Extracts table rows from markdown tables where each row represents
 * a diagnostic entry with brand, error code, meaning, causes, action plan, etc.
 */
function parseMarkdownToChunks(content: string): ParsedChunk[] {
  const chunks: ParsedChunk[] = [];
  const lines = content.split("\n");

  let currentCategory = "General";
  let inTable = false;
  let tableHeaders: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? "";

    // Detect section headers (## headers become categories)
    if (line.startsWith("## ")) {
      currentCategory = line
        .replace(/^##\s+\*\*/, "")
        .replace(/\*\*$/, "")
        .replace(/\\&/g, "&")
        .trim();
      inTable = false;
      continue;
    }

    // Detect table start (header row with Brand and Code columns)
    if (line.startsWith("|") && line.includes("Brand") && line.includes("Code")) {
      inTable = true;
      tableHeaders = line
        .split("|")
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean);
      continue;
    }

    // Skip table separator line
    if (inTable && line.startsWith("|") && line.match(/^\|[\s-:|]+\|$/)) {
      continue;
    }

    // Parse table data rows
    if (inTable && line.startsWith("|")) {
      const cells = line
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean);

      if (cells.length < 3) {
        inTable = false;
        continue;
      }

      // Map cells to headers
      const row: Record<string, string> = {};
      for (let j = 0; j < Math.min(tableHeaders.length, cells.length); j++) {
        const header = tableHeaders[j];
        if (header) {
          row[header] = cells[j] ?? "";
        }
      }

      const brand = row["brand & series"]?.replace(/\*\*/g, "").trim() || null;
      const errorCode = row["code & description"]?.replace(/\*\*/g, "").trim() || null;
      const meaning =
        row["meaning (english & burmese translation)"]?.replace(/\*\*/g, "").trim() || "";
      const causes = row["causes & trigger mechanisms"]?.replace(/\*\*/g, "").trim() || "";
      const actionPlan =
        row["safety-first action plan for technicians"]?.replace(/\*\*/g, "").trim() || "";
      const dangerLevel = row["danger level & source"]?.replace(/\*\*/g, "").trim() || null;

      // Build rich searchable content
      const contentParts: string[] = [];
      if (meaning) contentParts.push(`Meaning: ${meaning}`);
      if (causes) contentParts.push(`Causes: ${causes}`);
      if (actionPlan) contentParts.push(`Action Plan: ${actionPlan}`);

      const fullContent = contentParts.join("\n\n");

      if (fullContent.length > 20) {
        chunks.push({
          content: fullContent,
          brand,
          errorCode,
          dangerLevel,
          category: currentCategory,
        });
      }
      continue;
    }

    // End of table
    if (inTable && !line.startsWith("|")) {
      inTable = false;
    }
  }

  return chunks;
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
export async function POST(request: Request) {
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
    const chunks = parseMarkdownToChunks(content);

    if (chunks.length === 0) {
      return Response.json(
        {
          success: false,
          error:
            "No diagnostic tables found in the file. Make sure the .md file contains tables with Brand, Code, Meaning, Causes, and Action Plan columns.",
        },
        { status: 400 },
      );
    }

    // Clear existing chunks if requested
    if (clearExisting) {
      await db.delete(knowledgeChunks);
    }

    // Generate embeddings and insert
    const provider = getEmbeddingModel();
    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (const chunk of chunks) {
      try {
        const { embedding } = await embed({
          model: provider.textEmbeddingModel("gemini-embedding-001"),
          value: chunk.content,
        });

        await db.insert(knowledgeChunks).values({
          content: chunk.content,
          brand: chunk.brand,
          errorCode: chunk.errorCode,
          dangerLevel: chunk.dangerLevel,
          category: chunk.category,
          embedding,
        });

        successCount++;
      } catch (err) {
        failCount++;
        const label = chunk.errorCode ? `${chunk.brand} ${chunk.errorCode}` : chunk.category;
        errors.push(label);
        console.error(`Failed to import chunk: ${label}:`, err);
      }
    }

    revalidateTag(CACHE_TAGS.KNOWLEDGE_CHUNKS, "max");

    return Response.json({
      success: true,
      count: successCount,
      failed: failCount,
      total: chunks.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error("Knowledge upload failed:", err);
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 },
    );
  }
}
