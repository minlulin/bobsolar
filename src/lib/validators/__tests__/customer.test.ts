import { describe, expect, it } from "vitest";
import { createCustomerSchema, customerFilterSchema } from "@/lib/validators/customer";

describe("createCustomerSchema", () => {
  it("accepts valid customer", () => {
    const result = createCustomerSchema.safeParse({
      name: "John Doe",
      phone: "09-123456789",
      email: "john@example.com",
      address: "123 Solar Street",
      city: "Yangon",
    });
    expect(result.success).toBe(true);
  });

  it("accepts minimal customer (name + phone only)", () => {
    const result = createCustomerSchema.safeParse({
      name: "John Doe",
      phone: "09-123456789",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createCustomerSchema.safeParse({
      name: "",
      phone: "09-123456789",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = createCustomerSchema.safeParse({
      name: "John",
      phone: "09-123456789",
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("rejects phone too short", () => {
    const result = createCustomerSchema.safeParse({
      name: "John",
      phone: "1234",
    });
    expect(result.success).toBe(false);
  });

  it("accepts empty string email as valid", () => {
    const result = createCustomerSchema.safeParse({
      name: "John",
      phone: "09-123456789",
      email: "",
    });
    expect(result.success).toBe(true);
  });
});

describe("customerFilterSchema", () => {
  it("provides defaults for empty input", () => {
    const result = customerFilterSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it("coerces string numbers", () => {
    const result = customerFilterSchema.parse({ page: "2", limit: "10" });
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
  });

  it("rejects limit > MAX_PAGE_LIMIT", () => {
    const result = customerFilterSchema.safeParse({ limit: 200 });
    expect(result.success).toBe(false);
  });
});
