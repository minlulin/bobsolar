import { describe, expect, it } from "vitest";
import { paginationSchema, uuidSchema } from "@/lib/validators/common";

describe("uuidSchema", () => {
  it("accepts valid UUID", () => {
    const result = uuidSchema.safeParse("550e8400-e29b-41d4-a716-446655440000");
    expect(result.success).toBe(true);
  });

  it("rejects invalid UUID", () => {
    const result = uuidSchema.safeParse("not-a-uuid");
    expect(result.success).toBe(false);
  });

  it("rejects empty string", () => {
    const result = uuidSchema.safeParse("");
    expect(result.success).toBe(false);
  });

  it("rejects non-string input", () => {
    const result = uuidSchema.safeParse(123);
    expect(result.success).toBe(false);
  });

  it("rejects null", () => {
    const result = uuidSchema.safeParse(null);
    expect(result.success).toBe(false);
  });
});

describe("paginationSchema", () => {
  it("provides defaults for empty input", () => {
    const result = paginationSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it("accepts valid custom values", () => {
    const result = paginationSchema.parse({ page: 2, limit: 25 });
    expect(result.page).toBe(2);
    expect(result.limit).toBe(25);
  });

  it("rejects limit > 100", () => {
    const result = paginationSchema.safeParse({ limit: 200 });
    expect(result.success).toBe(false);
  });

  it("rejects negative limit", () => {
    const result = paginationSchema.safeParse({ limit: -1 });
    expect(result.success).toBe(false);
  });
});
