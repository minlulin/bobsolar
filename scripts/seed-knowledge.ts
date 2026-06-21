import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { google } from "@ai-sdk/google";
import { embedMany } from "ai";

import { db } from "../src/lib/db";
import { knowledgeChunks } from "../src/lib/db/schema";

async function main() {
  console.log("Starting seed process...");

  const entries = [
    {
      brand: "Growatt",
      errorCode: "F09",
      content:
        "Growatt Error Code 09 (or F09) indicates a 'Bus Soft Start Failed'. This is typically a critical hardware fault involving internal power conversion circuitry (IGBTs or MOSFETs). It often cannot be cleared by simply restarting. Troubleshooting: 1. Perform a Hard Power Cycle by completely disconnecting all power sources (PV, battery, AC) for 15-30 minutes. 2. Inspect wiring for short circuits. 3. Check for Surge Protection (SPDs). If the error persists, the inverter likely requires professional repair or replacement. Warning: Do not open internal circuit boards due to lethal capacitor charges.",
    },
    {
      brand: "Felicity",
      errorCode: "04",
      content:
        "Felicity Solar inverter Error Code 04 typically refers to an Overload Protection fault, meaning the power demand exceeds the rated capacity of the inverter. (Note: On some older models, 04 can indicate Battery Voltage Low). Troubleshooting for Overload: 1. Immediately turn off high-power appliances. 2. Restart the inverter. 3. Ensure no short circuits. If your model indicates Battery Low: Check battery voltage, inspect connections for tightness and corrosion, and charge the batteries.",
    },
  ];

  console.log("Generating embeddings...");
  const contents = entries.map((e) => e.content);

  const { embeddings } = await embedMany({
    model: google.textEmbeddingModel("gemini-embedding-001"),
    values: contents,
  });

  const rows = entries.map((entry, i) => ({
    brand: entry.brand,
    errorCode: entry.errorCode,
    content: entry.content,
    embedding: embeddings[i],
  }));

  console.log("Inserting chunks...");
  await db.insert(knowledgeChunks).values(rows);

  console.log("Seeding complete.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
