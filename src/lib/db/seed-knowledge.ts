/**
 * Knowledge Base Seeder
 *
 * Parses the bundled knowledge documents and seeds knowledge_chunks with embeddings.
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
import { setTimeout } from "node:timers/promises";
import "./load-env-local";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { embedMany } from "ai";
import { isQuotaError } from "../chat/key-rotator";
import { CHAT_DOCUMENT_EMBEDDING_TASK, CHAT_EMBEDDING_MODEL_ID } from "../domain/policies";
import {
  type KnowledgeDocumentDefaults,
  type ParsedKnowledgeChunk,
  parseKnowledgeMarkdown,
} from "../knowledge/markdown";
import { db } from "./index";
import { knowledgeChunks } from "./schema";

const EMBEDDING_BATCH_SIZE = 100;
const EMBEDDING_BATCH_DELAY_MS = 61_000;
const KNOWLEDGE_DIRECTORY = resolve(process.cwd(), "src", "lib", "knowledge", "data");
const KNOWLEDGE_DOCUMENTS: Array<{
  file: string;
  defaults?: KnowledgeDocumentDefaults;
}> = [
  { file: "Knowledge_Base.md" },
  {
    file: "Fault_Codes_and_Troubleshooting_3KVA_5KVA.md",
    defaults: {
      brand: "Felicity",
      model: "IVEM3048-LV, IVEM5048-LV",
      capacity: "3KVA, 5KVA",
    },
  },
  {
    file: "Fault_Codes_and_Troubleshooting_6KVA.md",
    defaults: { brand: "Felicity", model: "IVEM Series", capacity: "6KVA" },
  },
  {
    file: "Fault_Codes_and_Troubleshooting_8KVA_12KVA.md",
    defaults: {
      brand: "Felicity",
      model: "IVEM8048-II, IVEM12048-II",
      capacity: "8KVA, 12KVA",
    },
  },
  {
    file: "Growatt_SPF_3500_5000_ES_Fault_Codes.md",
    defaults: { brand: "Growatt", model: "SPF 3500 ES, SPF 5000 ES", capacity: "3.5KVA, 5KVA" },
  },
  {
    file: "Growatt_SPF_3000TL_LVM_ES_Fault_Codes.md",
    defaults: { brand: "Growatt", model: "SPF 3000TL LVM-ES", capacity: "3KVA" },
  },
  {
    file: "Growatt_SPF_3000T_HVM_G2_Fault_Codes.md",
    defaults: { brand: "Growatt", model: "SPF 3000T HVM-G2", capacity: "3KVA" },
  },
  {
    file: "Growatt_SPF_4000_12000T_DVM_US_Fault_Codes.md",
    defaults: {
      brand: "Growatt",
      model: "SPF 4000T-12000T DVM-US MPV",
      capacity: "4KVA, 5KVA, 6KVA, 8KVA, 10KVA, 12KVA",
    },
  },
];

function getEmbeddingProviders(): Array<{
  key: string;
  label: string;
  provider: ReturnType<typeof createGoogleGenerativeAI>;
}> {
  const envKeys = [
    ["GEMINI_API_KEY_PRIMARY", "primary"],
    ["GEMINI_API_KEY_BACKUP_1", "backup-1"],
    ["GEMINI_API_KEY_BACKUP_2", "backup-2"],
    ["GEMINI_API_KEY_BACKUP_3", "backup-3"],
    ["GEMINI_API_KEY_BACKUP_4", "backup-4"],
  ] as const;
  const providers = envKeys.flatMap(([envKey, label]) => {
    const key = process.env[envKey]?.trim();
    return key ? [{ key, label, provider: createGoogleGenerativeAI({ apiKey: key }) }] : [];
  });

  if (providers.length === 0) {
    throw new Error("No Gemini API key configured.");
  }
  return providers;
}

function chunkKey(
  chunk: Omit<ParsedKnowledgeChunk, "category"> & { category: string | null },
): string {
  return JSON.stringify([
    chunk.content,
    chunk.brand,
    chunk.model,
    chunk.capacity,
    chunk.errorCode,
    chunk.dangerLevel,
    chunk.category,
  ]);
}

async function seedKnowledge(): Promise<void> {
  console.log("=== Knowledge Base Seeder ===\n");

  // Check database URL
  if (!process.env["DATABASE_URL"]?.trim()) {
    console.error("DATABASE_URL is not set. Add your connection string to .env.local.");
    process.exit(1);
  }

  const chunks: ParsedKnowledgeChunk[] = [];
  for (const document of KNOWLEDGE_DOCUMENTS) {
    const filePath = resolve(KNOWLEDGE_DIRECTORY, document.file);
    const parsed = parseKnowledgeMarkdown(
      readFileSync(filePath, "utf-8"),
      document.defaults,
    ).filter(
      (chunk) => document.file !== "Knowledge_Base.md" || !chunk.brand?.startsWith("Growatt"),
    );
    chunks.push(...parsed);
    console.log(`Parsed ${parsed.length} chunks from ${document.file}`);
  }
  console.log(`Parsed ${chunks.length} knowledge chunks total`);

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

  const existingChunks = await db
    .select({
      content: knowledgeChunks.content,
      brand: knowledgeChunks.brand,
      model: knowledgeChunks.model,
      capacity: knowledgeChunks.capacity,
      errorCode: knowledgeChunks.errorCode,
      dangerLevel: knowledgeChunks.dangerLevel,
      category: knowledgeChunks.category,
      embedding: knowledgeChunks.embedding,
    })
    .from(knowledgeChunks);
  const reusableEmbeddings = new Map(
    existingChunks.map((chunk) => [chunkKey(chunk), chunk.embedding]),
  );
  const chunksToEmbed = chunks.filter((chunk) => !reusableEmbeddings.has(chunkKey(chunk)));

  // Generate every missing embedding before replacing existing knowledge.
  const providers = getEmbeddingProviders();
  let providerIndex = 0;
  console.log(
    `\nReusing ${chunks.length - chunksToEmbed.length} embeddings; generating ${chunksToEmbed.length}...`,
  );

  const embeddings: number[][] = [];
  let lastEmbeddingError: unknown;
  for (let index = 0; index < chunksToEmbed.length; index += EMBEDDING_BATCH_SIZE) {
    const batch = chunksToEmbed.slice(index, index + EMBEDDING_BATCH_SIZE);
    console.log(`Embedding new-content batch ${index / EMBEDDING_BATCH_SIZE + 1}...`);
    let embedded = false;
    for (let attempt = 0; attempt < providers.length; attempt++) {
      const currentIndex = (providerIndex + attempt) % providers.length;
      const current = providers[currentIndex];
      if (!current) continue;

      try {
        const result = await embedMany({
          model: current.provider.embedding(CHAT_EMBEDDING_MODEL_ID),
          values: batch.map((chunk) => chunk.content),
          providerOptions: { google: { taskType: CHAT_DOCUMENT_EMBEDDING_TASK } },
        });
        embeddings.push(...result.embeddings);
        providerIndex = (currentIndex + 1) % providers.length;
        embedded = true;
        break;
      } catch (error: unknown) {
        lastEmbeddingError = error;
        const reason = isQuotaError(error) ? "quota-limited" : "unavailable";
        console.warn(`Embedding key ${current.label} is ${reason}; trying the next key.`);
      }
    }
    if (!embedded) {
      throw new Error("All configured Gemini embedding keys failed.", {
        cause: lastEmbeddingError,
      });
    }
    if (index + EMBEDDING_BATCH_SIZE < chunksToEmbed.length) {
      console.log("Waiting for embedding quota window...");
      await setTimeout(EMBEDDING_BATCH_DELAY_MS);
    }
  }
  if (embeddings.length !== chunksToEmbed.length) {
    throw new Error("Embedding count mismatch; existing knowledge was not changed.");
  }
  const generatedEmbeddings = new Map<string, number[]>();
  for (let index = 0; index < chunksToEmbed.length; index++) {
    const chunk = chunksToEmbed[index];
    const embedding = embeddings[index];
    if (!chunk || !embedding) {
      throw new Error("Embedding count mismatch; existing knowledge was not changed.");
    }
    generatedEmbeddings.set(chunkKey(chunk), embedding);
  }

  const embeddedChunks: Array<ParsedKnowledgeChunk & { embedding: number[] }> = [];
  for (const chunk of chunks) {
    const embedding =
      reusableEmbeddings.get(chunkKey(chunk)) ?? generatedEmbeddings.get(chunkKey(chunk));
    if (!embedding) {
      throw new Error("Missing embedding; existing knowledge was not changed.");
    }
    embeddedChunks.push({ ...chunk, embedding });
  }

  await db.transaction(async (tx) => {
    await tx.delete(knowledgeChunks);
    await tx.insert(knowledgeChunks).values(embeddedChunks);
  });

  console.log(`\n=== Seeding Complete ===`);
  console.log(`Inserted: ${embeddedChunks.length}`);

  process.exit(0);
}

seedKnowledge().catch((err: unknown) => {
  console.error("Knowledge seeding failed:", err);
  process.exit(1);
});
