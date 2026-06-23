import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  deleted: false,
  inserted: [] as Array<Record<string, unknown>>,
}));

const spies = vi.hoisted(() => ({
  embed: vi.fn(),
  revalidateTag: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: vi.fn(() => ({
    embedding: vi.fn(() => ({ model: "gemini-embedding-001" })),
  })),
}));

vi.mock("ai", () => ({
  embed: spies.embed,
}));

vi.mock("next/cache", () => ({
  revalidateTag: spies.revalidateTag,
}));

vi.mock("@/lib/auth/validate", () => ({
  requireAdmin: vi.fn(async () => ({ userId: "admin-1", role: "admin" as const })),
}));

vi.mock("@/lib/db/schema", () => ({
  knowledgeChunks: { table: "knowledge_chunks" },
}));

vi.mock("@/lib/db", () => ({
  db: {
    transaction: spies.transaction,
  },
}));

function makeRequest(): Request {
  const markdown = [
    "## **Growatt Diagnostics**",
    "| Brand & Series | Code & Description | Meaning (English & Burmese Translation) | Causes & Trigger Mechanisms | Safety-First Action Plan for Technicians | Danger Level & Source |",
    "| --- | --- | --- | --- | --- | --- |",
    "| **Growatt** SPF | **Fault 09** | Bus start failure | Shorted PV input | Isolate AC and DC before testing | **Critical** |",
  ].join("\n");
  const formData = new FormData();
  formData.set("file", new File([markdown], "knowledge.md", { type: "text/markdown" }));
  formData.set("clearExisting", "true");

  return {
    formData: async () => formData,
  } as unknown as Request;
}

describe("POST /api/admin/knowledge/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.deleted = false;
    state.inserted = [];
    process.env["GEMINI_API_KEY_PRIMARY"] = "test-key";
    spies.transaction.mockImplementation(
      async (
        callback: (tx: {
          delete: () => Promise<void>;
          insert: () => { values: (rows: Array<Record<string, unknown>>) => Promise<void> };
        }) => Promise<void>,
      ) => {
        await callback({
          delete: async () => {
            state.deleted = true;
          },
          insert: () => ({
            values: async (rows) => {
              state.inserted = rows;
            },
          }),
        });
      },
    );
  });

  it("replaces knowledge in one transaction after embeddings succeed", async () => {
    spies.embed.mockResolvedValue({ embedding: [0.1, 0.2] });
    const { POST } = await import("./route");

    const response = await POST(makeRequest());
    const body = (await response.json()) as { success: boolean; count: number };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ success: true, count: 1 });
    expect(state.deleted).toBe(true);
    expect(state.inserted).toHaveLength(1);
    expect(spies.transaction).toHaveBeenCalledOnce();
    expect(spies.revalidateTag).toHaveBeenCalledOnce();
    expect(spies.embed).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOptions: { google: { taskType: "RETRIEVAL_DOCUMENT" } },
      }),
    );
  });

  it("preserves existing knowledge when embedding generation fails", async () => {
    spies.embed.mockRejectedValue(new Error("Gemini unavailable"));
    const { POST } = await import("./route");

    const response = await POST(makeRequest());
    const body = (await response.json()) as { success: boolean; error: string };

    expect(response.status).toBe(502);
    expect(body.success).toBe(false);
    expect(body.error).toContain("Existing knowledge was not changed");
    expect(spies.transaction).not.toHaveBeenCalled();
    expect(state.deleted).toBe(false);
    expect(spies.revalidateTag).not.toHaveBeenCalled();
  });
});
