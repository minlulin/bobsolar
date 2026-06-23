/**
 * Knowledge Base Seeder
 *
 * Parses docs/Knowledge_Base.md and seeds knowledge_chunks table with embeddings.
 * Each table row becomes a knowledge chunk. Section headers become category context.
 *
 * Usage: pnpm tsx src/lib/db/seed-knowledge.ts
 *
 * Environment variables required:
 *   DATABASE_URL - Postgres connection string
 *   GEMINI_API_KEY_PRIMARY or GEMINI_API_KEY - For generating embeddings
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import "./load-env-local";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { embed } from "ai";
import { CHAT_DOCUMENT_EMBEDDING_TASK, CHAT_EMBEDDING_MODEL_ID } from "../domain/policies";
import { db } from "./index";
import { knowledgeChunks } from "./schema";

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
    throw new Error("No Gemini API key configured. Set GEMINI_API_KEY_PRIMARY or GEMINI_API_KEY.");
  }
  return createGoogleGenerativeAI({ apiKey });
}

/**
 * Parse the markdown knowledge base file into structured chunks.
 *
 * Strategy:
 * - Each table row becomes one knowledge chunk
 * - The "Meaning" column provides the primary searchable content
 * - "Causes" and "Action Plan" are appended for richer context
 * - Section headers become the category
 * - Brand and error code are extracted for filtering
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

    // Detect table start
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

async function seedKnowledge(): Promise<void> {
  console.log("=== Knowledge Base Seeder ===\n");

  // Check database URL
  if (!process.env["DATABASE_URL"]?.trim()) {
    console.error("DATABASE_URL is not set. Add your connection string to .env.local.");
    process.exit(1);
  }

  // Read the knowledge base file
  let fileContent: string;
  try {
    fileContent = readFileSync(KNOWLEDGE_FILE, "utf-8");
    console.log(`Read knowledge base: ${KNOWLEDGE_FILE}`);
  } catch (err) {
    console.error(`Failed to read ${KNOWLEDGE_FILE}:`, err);
    process.exit(1);
  }

  // Parse chunks
  const chunks = parseKnowledgeBase(fileContent);
  console.log(`Parsed ${chunks.length} knowledge chunks from markdown`);

  if (chunks.length === 0) {
    console.error("No chunks parsed. Check the markdown file format.");
    process.exit(1);
  }

  // Show summary by category
  const byCategory: Record<string, number> = {};
  const byBrand: Record<string, number> = {};
  for (const chunk of chunks) {
    byCategory[chunk.category] = (byCategory[chunk.category] || 0) + 1;
    const brand = chunk.brand || "Unknown";
    byBrand[brand] = (byBrand[brand] || 0) + 1;
  }

  console.log("\nChunks by category:");
  for (const [cat, count] of Object.entries(byCategory)) {
    console.log(`  ${cat}: ${count}`);
  }
  console.log("\nChunks by brand:");
  for (const [brand, count] of Object.entries(byBrand)) {
    console.log(`  ${brand}: ${count}`);
  }

  // Clear existing knowledge chunks
  console.log("\nClearing existing knowledge chunks...");
  await db.delete(knowledgeChunks);
  console.log("Cleared.");

  // Generate embeddings and insert
  const provider = getEmbeddingModel();
  let successCount = 0;
  let failCount = 0;

  console.log(`\nGenerating embeddings and inserting ${chunks.length} chunks...`);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!chunk) continue;

    try {
      const { embedding } = await embed({
        model: provider.embedding(CHAT_EMBEDDING_MODEL_ID),
        value: chunk.content,
        providerOptions: { google: { taskType: CHAT_DOCUMENT_EMBEDDING_TASK } },
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
      const progress = `[${i + 1}/${chunks.length}]`;
      const label = chunk.errorCode ? `${chunk.brand} ${chunk.errorCode}` : chunk.category;
      console.log(`  ${progress} ✓ ${label}`);
    } catch (err) {
      failCount++;
      console.error(
        `  [${i + 1}/${chunks.length}] ✗ Failed: ${chunk.brand} ${chunk.errorCode}:`,
        err,
      );
    }
  }

  console.log(`\n=== Seeding Complete ===`);
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Total: ${chunks.length}`);

  process.exit(0);
}

seedKnowledge().catch((err: unknown) => {
  console.error("Knowledge seeding failed:", err);
  process.exit(1);
});
