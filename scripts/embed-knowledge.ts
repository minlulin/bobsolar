import fs from "node:fs";
import path from "node:path";
import { config } from "dotenv";

config({ path: ".env.local" });

import { google } from "@ai-sdk/google";
import { neon } from "@neondatabase/serverless";
import { embedMany } from "ai";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { knowledgeChunks } from "../src/lib/db/schema";

const kbPath = path.join(process.cwd(), "docs", "Knowledge_Base.md");
const kbContent = fs.readFileSync(kbPath, "utf-8");

function extractErrorCodesFromKB(content: string) {
  const errorCodes = [];
  const lines = content.split("\n");

  let currentBrand = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() || "";

    // Track the closest brand heading (e.g. ## **Growatt** SPF Series)
    const headingMatch = line.match(/^##\s+\*\*(.*?)\*\*(.*)/);
    if (headingMatch) {
      currentBrand = `${headingMatch[1]} ${headingMatch[2]}`.trim();
    }

    if (line.startsWith("|") && line.endsWith("|")) {
      // Ignore header rows
      if (line.includes("Code & Description") || line.includes(":---")) {
        continue;
      }

      const columns = line
        .split("|")
        .map((col) => col.trim().replace(/^\*\*|\*$/g, ""))
        .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1); // remove empty edge columns

      if (columns.length >= 6) {
        const brandInfo = columns[0] || "";
        const codeInfo = columns[1] || "";
        const meaning = columns[2] || "";
        const causes = columns[3] || "";
        const actionPlan = columns[4] || "";
        const dangerLevel = columns[5] || "";

        const codeMatch = codeInfo.match(/(\d+|F\d+|W\d+|Error \d+|Warning \d+|Alarm \d+)/);
        const code = codeMatch ? codeMatch[1] : codeInfo;

        const brand = currentBrand || brandInfo;

        const contentBlock = `Brand: ${brand}\nCode: ${codeInfo}\nMeaning: ${meaning}\nCauses: ${causes}\nAction Plan: ${actionPlan}\nDanger Level: ${dangerLevel}`;

        errorCodes.push({
          code,
          brand,
          content: contentBlock,
        });
      }
    }
  }

  return errorCodes;
}

async function main() {
  console.log("Extracting error codes from KB...");
  const items = extractErrorCodesFromKB(kbContent);
  console.log(`Extracted ${items.length} items. Generaing embeddings...`);

  if (items.length === 0) {
    console.error("No items extracted.");
    return;
  }

  // Generate embeddings in batches of 100 to avoid rate limits
  const BATCH_SIZE = 100;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not defined in env");
  }
  const db = drizzle(neon(databaseUrl));

  // Truncate table before seeding
  console.log("Truncating existing knowledge_chunks...");
  await db.execute(sql`TRUNCATE TABLE knowledge_chunks`);

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    console.log(`Processing batch ${i / BATCH_SIZE + 1}...`);

    const values = batch.map((item) => item.content);

    const { embeddings } = await embedMany({
      model: google.textEmbeddingModel("gemini-embedding-001"),
      values,
    });

    const rowsToInsert = batch.map((item, index) => ({
      content: item.content,
      brand: item.brand,
      errorCode: item.code,
      embedding: embeddings[index],
    }));

    await db.insert(knowledgeChunks).values(rowsToInsert);
  }

  console.log("Seeding complete!");
}

main().catch(console.error);
