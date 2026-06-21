CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE "knowledge_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content" text NOT NULL,
	"brand" text,
	"error_code" text,
	"embedding" vector(768) NOT NULL
);
