import { describe, expect, it } from "vitest";
import { createQuotationSchema, updateQuotationStatusSchema } from "@/lib/validators/quotation";

describe("createQuotationSchema", () => {
  const validItem = {
    itemId: "550e8400-e29b-41d4-a716-446655440000",
    description: "Solar Panel 400W",
    quantity: 2,
    unitPrice: 350000,
  };

  it("accepts valid quotation data", () => {
    const result = createQuotationSchema.safeParse({
      customerId: "550e8400-e29b-41d4-a716-446655440000",
      items: [validItem],
      discountPercent: 0,
      taxPercent: 5,
    });
    expect(result.success).toBe(true);
  });

  it("rejects quotation without items", () => {
    const result = createQuotationSchema.safeParse({
      customerId: "550e8400-e29b-41d4-a716-446655440000",
      items: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative discount", () => {
    const result = createQuotationSchema.safeParse({
      customerId: "550e8400-e29b-41d4-a716-446655440000",
      items: [validItem],
      discountPercent: -10,
    });
    expect(result.success).toBe(false);
  });

  it("rejects discount > 100", () => {
    const result = createQuotationSchema.safeParse({
      customerId: "550e8400-e29b-41d4-a716-446655440000",
      items: [validItem],
      discountPercent: 110,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative tax", () => {
    const result = createQuotationSchema.safeParse({
      customerId: "550e8400-e29b-41d4-a716-446655440000",
      items: [validItem],
      taxPercent: -5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-UUID customer ID", () => {
    const result = createQuotationSchema.safeParse({
      customerId: "not-a-uuid",
      items: [validItem],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid item quantity (0)", () => {
    const result = createQuotationSchema.safeParse({
      customerId: "550e8400-e29b-41d4-a716-446655440000",
      items: [{ ...validItem, quantity: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty description", () => {
    const result = createQuotationSchema.safeParse({
      customerId: "550e8400-e29b-41d4-a716-446655440000",
      items: [{ ...validItem, description: "" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("updateQuotationStatusSchema", () => {
  it("accepts valid status with id", () => {
    const result = updateQuotationStatusSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      status: "sent",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status", () => {
    const result = updateQuotationStatusSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      status: "invalid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing id", () => {
    const result = updateQuotationStatusSchema.safeParse({
      status: "sent",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing status", () => {
    const result = updateQuotationStatusSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(false);
  });
});
