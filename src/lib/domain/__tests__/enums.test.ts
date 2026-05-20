import { describe, expect, it } from "vitest";
import {
  canTransitionProjectStatus,
  canTransitionQuotationStatus,
  INVENTORY_CATEGORIES,
  inventoryCategorySchema,
  isProjectStatus,
  isQuotationStatus,
  PROJECT_STATUSES,
  QUOTATION_STATUSES,
  quotationStatusSchema,
  USER_ROLES,
  userRoleSchema,
} from "@/lib/domain/enums";

describe("USER_ROLES", () => {
  it("contains expected roles", () => {
    expect(USER_ROLES).toContain("admin");
    expect(USER_ROLES).toContain("staff");
  });

  it("validates correct role", () => {
    const result = userRoleSchema.safeParse("admin");
    expect(result.success).toBe(true);
  });

  it("rejects invalid role", () => {
    const result = userRoleSchema.safeParse("superadmin");
    expect(result.success).toBe(false);
  });
});

describe("QUOTATION_STATUSES", () => {
  it("contains all expected statuses", () => {
    expect(QUOTATION_STATUSES).toContain("draft");
    expect(QUOTATION_STATUSES).toContain("sent");
    expect(QUOTATION_STATUSES).toContain("accepted");
    expect(QUOTATION_STATUSES).toContain("rejected");
    expect(QUOTATION_STATUSES).toContain("expired");
  });

  it("validates correct status", () => {
    const result = quotationStatusSchema.safeParse("accepted");
    expect(result.success).toBe(true);
  });

  it("rejects invalid status", () => {
    const result = quotationStatusSchema.safeParse("pending");
    expect(result.success).toBe(false);
  });
});

describe("PROJECT_STATUSES", () => {
  it("contains all expected statuses", () => {
    expect(PROJECT_STATUSES).toContain("planning");
    expect(PROJECT_STATUSES).toContain("in_progress");
    expect(PROJECT_STATUSES).toContain("on_hold");
    expect(PROJECT_STATUSES).toContain("installation_completed");
    expect(PROJECT_STATUSES).toContain("completed");
    expect(PROJECT_STATUSES).toContain("cancelled");
  });
});

describe("INVENTORY_CATEGORIES", () => {
  it("contains all expected categories", () => {
    expect(INVENTORY_CATEGORIES).toContain("panel");
    expect(INVENTORY_CATEGORIES).toContain("inverter");
    expect(INVENTORY_CATEGORIES).toContain("battery");
    expect(INVENTORY_CATEGORIES).toContain("mounting");
    expect(INVENTORY_CATEGORIES).toContain("cable");
    expect(INVENTORY_CATEGORIES).toContain("accessory");
    expect(INVENTORY_CATEGORIES).toContain("labor");
  });

  it("validates correct category", () => {
    const result = inventoryCategorySchema.safeParse("panel");
    expect(result.success).toBe(true);
  });

  it("rejects invalid category", () => {
    const result = inventoryCategorySchema.safeParse("motor");
    expect(result.success).toBe(false);
  });
});

describe("isQuotationStatus", () => {
  it("returns true for valid status", () => {
    expect(isQuotationStatus("sent")).toBe(true);
  });

  it("returns false for invalid status", () => {
    expect(isQuotationStatus("cancelled")).toBe(false);
  });
});

describe("isProjectStatus", () => {
  it("returns true for valid status", () => {
    expect(isProjectStatus("in_progress")).toBe(true);
  });

  it("returns false for invalid status", () => {
    expect(isProjectStatus("archived")).toBe(false);
  });
});

describe("canTransitionQuotationStatus", () => {
  it("allows draft to sent", () => {
    expect(canTransitionQuotationStatus("draft", "sent")).toBe(true);
  });

  it("allows sent to accepted", () => {
    expect(canTransitionQuotationStatus("sent", "accepted")).toBe(true);
  });

  it("allows sent to rejected", () => {
    expect(canTransitionQuotationStatus("sent", "rejected")).toBe(true);
  });

  it("allows accepted to draft (reopen)", () => {
    expect(canTransitionQuotationStatus("accepted", "draft")).toBe(true);
  });

  it("blocks draft to accepted", () => {
    expect(canTransitionQuotationStatus("draft", "accepted")).toBe(false);
  });

  it("blocks accepted to sent", () => {
    expect(canTransitionQuotationStatus("accepted", "sent")).toBe(false);
  });

  it("blocks rejected to accepted", () => {
    expect(canTransitionQuotationStatus("rejected", "accepted")).toBe(false);
  });
});

describe("canTransitionProjectStatus", () => {
  it("allows planning to in_progress", () => {
    expect(canTransitionProjectStatus("planning", "in_progress")).toBe(true);
  });

  it("allows in_progress to on_hold", () => {
    expect(canTransitionProjectStatus("in_progress", "on_hold")).toBe(true);
  });

  it("allows on_hold to in_progress", () => {
    expect(canTransitionProjectStatus("on_hold", "in_progress")).toBe(true);
  });

  it("allows in_progress to installation_completed", () => {
    expect(canTransitionProjectStatus("in_progress", "installation_completed")).toBe(true);
  });

  it("blocks completed to in_progress", () => {
    expect(canTransitionProjectStatus("completed", "in_progress")).toBe(false);
  });

  it("blocks planning to completed", () => {
    expect(canTransitionProjectStatus("planning", "completed")).toBe(false);
  });

  it("allows installation_completed to completed", () => {
    expect(canTransitionProjectStatus("installation_completed", "completed")).toBe(true);
  });
});
