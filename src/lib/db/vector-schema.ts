import { pgTable, text, timestamp, uuid, vector } from "drizzle-orm/pg-core";

export const knowledgeChunks = pgTable("knowledge_chunks", {
  id: uuid("id").defaultRandom().primaryKey(),
  content: text("content").notNull(),
  brand: text("brand"),
  model: text("model"),
  capacity: text("capacity"),
  errorCode: text("error_code"),
  dangerLevel: text("danger_level"), // Minor, Medium, Major, Critical
  category: text("category"), // e.g. "Grid", "Isolation", "BMS", "Thermal", "General"
  embedding: vector("embedding", { dimensions: 3072 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
