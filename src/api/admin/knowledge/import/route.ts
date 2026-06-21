import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { embed } from "ai";
import { requireAdmin } from "@/lib/auth/validate";
import { db } from "@/lib/db";
import { knowledgeChunks } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const KNOWLEDGE_FILE = resolve(process.cwd(), "docs", "Knowledge_Base.md");

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
 * Parse the markdown knowledge base file into structured chunks.
 * Each table row becomes one knowledge chunk with brand, error code,
 * meaning, causes, action plan, and danger level.
 */
function parseKnowledgeBase(content: string): ParsedChunk[] {
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
 * POST /api/admin/knowledge/import
 *
 * Parses docs/Knowledge_Base.md and seeds all knowledge chunks with embeddings.
 * Requires admin authentication. Clears existing chunks before importing.
 */
export async function POST() {
  try {
    await requireAdmin();

    // Read the knowledge base file
    let fileContent: string;
    try {
      fileContent = readFileSync(KNOWLEDGE_FILE, "utf-8");
    } catch {
      return Response.json(
        { success: false, error: `Knowledge base file not found: ${KNOWLEDGE_FILE}` },
        { status: 404 },
      );
    }

    // Parse chunks
    const chunks = parseKnowledgeBase(fileContent);

    if (chunks.length === 0) {
      return Response.json(
        { success: false, error: "No knowledge chunks found in the file" },
        { status: 400 },
      );
    }

    // Clear existing chunks
    await db.delete(knowledgeChunks);

    // Generate embeddings and insert
    const provider = getEmbeddingModel();
    let successCount = 0;
    let failCount = 0;

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
        console.error(`Failed to import chunk: ${chunk.brand} ${chunk.errorCode}:`, err);
      }
    }

    return Response.json({
      success: true,
      count: successCount,
      failed: failCount,
      total: chunks.length,
    });
  } catch (err) {
    console.error("Knowledge import failed:", err);
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : "Import failed" },
      { status: 500 },
    );
  }
}
