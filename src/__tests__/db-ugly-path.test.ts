import { randomUUID } from "node:crypto";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { count, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import ws from "ws";
import { createQuotation } from "@/actions/quotation-actions";
import { db } from "@/lib/db";
import { customers, quotations, users } from "@/lib/db/schema";

const databaseUrl = process.env["DATABASE_URL"] ?? "";
const hasTestDb = databaseUrl.length > 0;
const runDbTests = process.env["RUN_DB_TESTS"] === "1";
const describeDb = hasTestDb && runDbTests ? describe : describe.skip;

let authUserId: string | null = null;
let insertedCustomerId: string | null = null;
let createdUserId: string | null = null;

vi.mock("@/lib/auth/validate", () => ({
  requireAuth: async (): Promise<{
    userId: string;
    role: "admin" | "staff";
  }> => {
    if (!authUserId) throw new Error("Auth user not initialized");
    return await Promise.resolve({
      userId: authUserId,
      role: "admin" as const,
    });
  },
  requireAdmin: async (): Promise<{ userId: string; role: "admin" }> => {
    if (!authUserId) throw new Error("Auth user not initialized");
    return await Promise.resolve({
      userId: authUserId,
      role: "admin" as const,
    });
  },
  requireFinanceAccess: async (): Promise<{ userId: string; role: "admin" }> => {
    if (!authUserId) throw new Error("Auth user not initialized");
    return await Promise.resolve({
      userId: authUserId,
      role: "admin" as const,
    });
  },
}));

neonConfig.webSocketConstructor = ws;

async function getQuotationCount(): Promise<number> {
  const rows = await db.select({ total: count() }).from(quotations);
  return rows[0]?.total ?? 0;
}

describeDb("DB ugly paths: constraint failures", () => {
  beforeAll(async () => {
    try {
      await db.execute("select 1");
    } catch (error) {
      throw new Error(
        `Cannot connect to test database via DATABASE_URL (mapped from TEST_DATABASE_URL in vitest). ${String(error)}`,
      );
    }

    const existingUser = await db.query.users.findFirst({
      columns: { id: true },
    });
    if (existingUser?.id) {
      authUserId = existingUser.id;
      return;
    }

    const email = `ugly+${Date.now()}@example.com`;
    const inserted = await db
      .insert(users)
      .values({
        email,
        passwordHash: "test_hash",
        name: "Ugly Path User",
        role: "admin",
      })
      .returning({ id: users.id });

    authUserId = inserted[0]?.id ?? null;
    createdUserId = authUserId;
    if (!authUserId) {
      throw new Error(
        "Failed to initialize auth user for DB tests. Verify TEST_DATABASE_URL and migrations.",
      );
    }
  });

  afterAll(async () => {
    if (!authUserId) return;

    if (insertedCustomerId) {
      await db.delete(customers).where(eq(customers.id, insertedCustomerId));
    }

    await db.delete(quotations).where(eq(quotations.createdBy, authUserId));
    if (createdUserId) {
      await db.delete(users).where(eq(users.id, createdUserId));
    }
  });

  it("createQuotation fails when customerId does not exist", async () => {
    const initialQuotes = await getQuotationCount();
    const nonExistentCustomerId = randomUUID();

    const result = await createQuotation({
      customerId: nonExistentCustomerId,
      items: [
        {
          itemId: null,
          description: "Solar panel test",
          quantity: 1,
          unitPrice: 350000,
          discountPercentage: 0,
        },
      ],
      discountPercent: 0,
      taxPercent: 5,
      notes: null,
      validUntil: null,
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected createQuotation to fail");
    const msg = result.error.toLowerCase();
    expect(
      msg.includes("failed query") || msg.includes("foreign key") || msg.includes("23503"),
    ).toBe(true);

    const afterQuotes = await getQuotationCount();
    expect(afterQuotes).toBe(initialQuotes);
  });

  it("createQuotation fails when itemId does not exist", async () => {
    const initialQuotes = await getQuotationCount();

    const pool = new Pool({
      connectionString: process.env["DATABASE_URL"] ?? "",
    });
    const insertRes = await pool.query<{ id: string }>(
      "insert into customers (name, phone) values ($1, $2) returning id",
      ["Customer for ugly path", "09-123456789"],
    );
    insertedCustomerId = insertRes.rows[0]?.id ?? null;
    await pool.end();

    if (!insertedCustomerId) throw new Error("Failed to create test customer");

    const nonExistentItemId = randomUUID();
    const result = await createQuotation({
      customerId: insertedCustomerId,
      items: [
        {
          itemId: nonExistentItemId,
          description: "Non-existent inventory item test",
          quantity: 1,
          unitPrice: 100000,
          discountPercentage: 0,
        },
      ],
      discountPercent: 0,
      taxPercent: 5,
      notes: null,
      validUntil: null,
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected createQuotation to fail");
    const msg = result.error.toLowerCase();
    expect(
      msg.includes("failed query") || msg.includes("foreign key") || msg.includes("23503"),
    ).toBe(true);

    const afterQuotes = await getQuotationCount();
    expect(afterQuotes).toBe(initialQuotes);
  });
});
