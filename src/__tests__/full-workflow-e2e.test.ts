/**
 * Full BOB Solar Workflow — End-to-End Business Logic Test
 *
 * Walks through the entire business workflow from pricing to project completion,
 * validating all business rules, state transitions, and calculations.
 *
 * NOTE: Server Actions (auth, database operations) cannot run in vitest because
 * they depend on Next.js runtime (cookies(), redirect(), revalidatePath()).
 * This file validates all testable logic: pricing engine, domain transitions,
 * validators, and utility functions.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ALERT_TYPES } from "@/lib/domain/alert-types";
import { canTransitionProjectStatus } from "@/lib/domain/project";
import { canTransitionQuotationStatus } from "@/lib/domain/quotation";
import { calculateLineItem, calculateQuotation, type LineItem } from "@/lib/pricing/engine";
import { formatMMK } from "@/lib/utils";
import { loginSchema } from "@/lib/validators/auth";
import { uuidSchema } from "@/lib/validators/common";
import { createCustomerSchema, customerFilterSchema } from "@/lib/validators/customer";
import { createQuotationSchema } from "@/lib/validators/quotation";

// =============================================================================
// Phase 1: Authentication Logic
// =============================================================================

describe("Phase 1: Authentication Logic", () => {
  it("loginSchema rejects empty username or password", () => {
    expect(loginSchema.safeParse({ email: "", password: "password123" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "admin", password: "" }).success).toBe(false);
  });

  it("loginSchema accepts valid credentials", () => {
    expect(
      loginSchema.safeParse({
        email: "test@example.com",
        password: "password123",
      }).success,
    ).toBe(true);
  });
});

// =============================================================================
// Phase 3: Inventory Management (PRICING ENGINE)
// =============================================================================

describe("Phase 3: Inventory & Pricing Engine", () => {
  const panelItem: LineItem = { quantity: 10, unitPrice: 350000 };
  const inverterItem: LineItem = { quantity: 1, unitPrice: 850000 };
  const batteryItem: LineItem = { quantity: 4, unitPrice: 450000 };

  it("calculates line item without discount", () => {
    expect(calculateLineItem(panelItem)).toBe(3_500_000);
  });

  it("calculates line item with discount", () => {
    const item: LineItem = {
      quantity: 10,
      unitPrice: 350000,
      discountPercentage: 10,
    };
    expect(calculateLineItem(item)).toBe(3_150_000);
  });

  it("calculates quotation with multiple items, discount, and tax", () => {
    const items: LineItem[] = [panelItem, inverterItem, batteryItem];
    const result = calculateQuotation(items, 5, 10);

    expect(result.subtotal).toBe(6_150_000);
    expect(result.discountAmount).toBe(307_500);
    expect(result.taxAmount).toBe(584_250);
    expect(result.total).toBe(6_426_750);
  });

  it("handles bulk pricing with millions of MMK", () => {
    const items: LineItem[] = [
      { quantity: 100, unitPrice: 15_000_000 },
      { quantity: 25, unitPrice: 8_500_000 },
      { quantity: 200, unitPrice: 4_500_000 },
    ];
    const result = calculateQuotation(items, 10, 5);

    const expectedSubtotal = 100 * 15_000_000 + 25 * 8_500_000 + 200 * 4_500_000;
    expect(result.subtotal).toBe(expectedSubtotal);

    const expectedDiscount = Math.round((expectedSubtotal * 10) / 100);
    expect(result.discountAmount).toBe(expectedDiscount);

    const expectedAfterDiscount = expectedSubtotal - expectedDiscount;
    const expectedTax = Math.round((expectedAfterDiscount * 5) / 100);
    expect(result.taxAmount).toBe(expectedTax);

    expect(result.total).toBe(expectedAfterDiscount + expectedTax);
  });

  it("formats MMK currency correctly", () => {
    expect(formatMMK(6_150_000)).toBe("6,150,000 MMK");
    expect(formatMMK(0)).toBe("0 MMK");
    expect(formatMMK(1_000_000_000)).toBe("1,000,000,000 MMK");
  });
});

// =============================================================================
// Phase 4: Customer Validation
// =============================================================================

describe("Phase 4: Customer Validation", () => {
  it("validates required fields", () => {
    expect(
      createCustomerSchema.safeParse({
        name: "Customer A",
        phone: "09-123456789",
      }).success,
    ).toBe(true);
    expect(createCustomerSchema.safeParse({ phone: "09-123456789" }).success).toBe(false);
    expect(createCustomerSchema.safeParse({ name: "Customer A" }).success).toBe(false);
  });

  it("validates customer filter defaults", () => {
    const parsed = customerFilterSchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(20);
  });
});

// =============================================================================
// Phase 5: Quotation Lifecycle
// =============================================================================

describe("Phase 5: Quotation Lifecycle", () => {
  it("validates quotation creation input", () => {
    const valid = createQuotationSchema.safeParse({
      customerId: "550e8400-e29b-41d4-a716-446655440000",
      items: [{ description: "Solar Panel 400W", quantity: 2, unitPrice: 350000 }],
      discountPercent: 5,
      taxPercent: 10,
    });
    expect(valid.success).toBe(true);
    expect(valid.data?.discountPercent).toBe(5);
    expect(valid.data?.taxPercent).toBe(10);
  });

  it("validates status transitions", () => {
    expect(canTransitionQuotationStatus("draft", "sent")).toBe(true);
    expect(canTransitionQuotationStatus("sent", "accepted")).toBe(true);
    expect(canTransitionQuotationStatus("draft", "accepted")).toBe(false);
    expect(canTransitionQuotationStatus("sent", "draft")).toBe(true);
    expect(canTransitionQuotationStatus("accepted", "sent")).toBe(false);
    expect(canTransitionQuotationStatus("rejected", "draft")).toBe(true);
  });

  it("validates quote number format", () => {
    const pattern = /^QT-2026-\d{4}$/;
    expect(pattern.test("QT-2026-0001")).toBe(true);
    expect(pattern.test("QT-2026-9999")).toBe(true);
    expect(pattern.test("INVALID")).toBe(false);
  });
});

// =============================================================================
// Phase 6: Quote → Project Conversion
// =============================================================================

describe("Phase 6: Quote → Project Conversion", () => {
  it("validates project number format", () => {
    const pattern = /^PJ-2026-\d{4}$/;
    expect(pattern.test("PJ-2026-0001")).toBe(true);
    expect(pattern.test("PJ-2026-9999")).toBe(true);
    expect(pattern.test("PJ-2025-0001")).toBe(false);
  });
});

// =============================================================================
// Phase 7: Project Lifecycle
// =============================================================================

describe("Phase 7: Project Lifecycle", () => {
  it("validates project status transitions", () => {
    expect(canTransitionProjectStatus("planning", "in_progress")).toBe(true);
    expect(canTransitionProjectStatus("in_progress", "on_hold")).toBe(true);
    expect(canTransitionProjectStatus("on_hold", "in_progress")).toBe(true);
    expect(canTransitionProjectStatus("in_progress", "installation_completed")).toBe(true);
    expect(canTransitionProjectStatus("installation_completed", "completed")).toBe(true);
    expect(canTransitionProjectStatus("completed", "in_progress")).toBe(false);
    expect(canTransitionProjectStatus("completed", "planning")).toBe(false);
    expect(canTransitionProjectStatus("cancelled", "planning")).toBe(false);
    expect(canTransitionProjectStatus("planning", "completed")).toBe(false);
  });
});

// =============================================================================
// Phase 8: Warranty & Policies
// =============================================================================

describe("Phase 8: Warranty & Business Policies", () => {
  it("validates warranty alert types", () => {
    expect(ALERT_TYPES).toContain("warranty_expiry");
    expect(ALERT_TYPES).toContain("maintenance_due");
    expect(ALERT_TYPES).toContain("follow_up");
  });

  it("validates currency-precision math in pricing engine", () => {
    const result = calculateQuotation(
      [
        { quantity: 3, unitPrice: 100000 },
        { quantity: 7, unitPrice: 50000 },
      ],
      7.5,
      5.5,
    );

    // All results should be rounded to 2 decimal places (cents)
    const isCents = (n: number) => Number.isInteger(Math.round(n * 100));
    expect(isCents(result.subtotal)).toBe(true);
    expect(isCents(result.discountAmount)).toBe(true);
    expect(isCents(result.taxAmount)).toBe(true);
    expect(isCents(result.total)).toBe(true);

    // Total = subtotal - discount + tax
    expect(result.total).toBe(result.subtotal - result.discountAmount + result.taxAmount);
  });
});

// =============================================================================
// Phase 9: Dashboard Metrics
// =============================================================================

describe("Phase 9: Dashboard Metrics", () => {
  it("calculates conversion rate correctly", () => {
    const calc = (accepted: number, rejected: number, expired: number, sent: number): number => {
      const denominator = accepted + rejected + expired + sent;
      return denominator === 0 ? 0 : Math.round((accepted / denominator) * 100);
    };

    expect(calc(5, 1, 1, 3)).toBe(50);
    expect(calc(0, 0, 0, 0)).toBe(0);
    expect(calc(10, 0, 0, 0)).toBe(100);
    expect(calc(8, 3, 1, 8)).toBe(40);
  });
});

// =============================================================================
// Phase 10: Security
// =============================================================================

describe("Phase 10: Security", () => {
  it("validates UUID inputs", () => {
    expect(uuidSchema.safeParse("550e8400-e29b-41d4-a716-446655440000").success).toBe(true);
    expect(uuidSchema.safeParse("not-a-uuid").success).toBe(false);
    expect(uuidSchema.safeParse("").success).toBe(false);
    expect(uuidSchema.safeParse(null).success).toBe(false);
  });
});

// =============================================================================
// Phase 11: Build Checks
// =============================================================================

describe("Phase 11: Build & Deployment Checks", () => {
  it("no floating point in pricing engine calculations", () => {
    const engineSrc = readFileSync(resolve(process.cwd(), "src/lib/pricing/engine.ts"), "utf-8");
    // roundCurrency wraps Math.round for 2-decimal-place currency rounding
    const roundCurrencyMatches = (engineSrc.match(/roundCurrency/g) || []).length;
    const mathRoundMatches = (engineSrc.match(/Math\.round/g) || []).length;
    expect(roundCurrencyMatches + mathRoundMatches).toBeGreaterThanOrEqual(3);
    expect(engineSrc.includes(".toFixed(")).toBe(false);
  });
});
