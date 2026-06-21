import { pgTable, text, uuid, vector } from "drizzle-orm/pg-core";

export const knowledgeChunks = pgTable("knowledge_chunks", {
  id: uuid("id").defaultRandom().primaryKey(),
  content: text("content").notNull(),
  brand: text("brand"),
  errorCode: text("error_code"),
  embedding: vector("embedding", { dimensions: 3072 }).notNull(),
});
