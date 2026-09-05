import { describe, expect, it } from "vitest";
import { INVOICE_STATUS_LABELS, isInvoiceOverdue, isOpenInvoiceStatus } from "@/lib/domain/invoice";

const NOW = new Date("2026-09-05T10:30:00");
const YESTERDAY = new Date("2026-09-04T23:59:59");
const TODAY_EARLY = new Date("2026-09-05T00:00:00");
const TOMORROW = new Date("2026-09-06T00:00:00");

describe("isInvoiceOverdue", () => {
  it("marks posted open invoices past their due date as overdue", () => {
    expect(isInvoiceOverdue("unpaid", YESTERDAY, NOW)).toBe(true);
    expect(isInvoiceOverdue("partial", YESTERDAY, NOW)).toBe(true);
  });

  it("due date today is not yet overdue (boundary is start of day)", () => {
    expect(isInvoiceOverdue("unpaid", TODAY_EARLY, NOW)).toBe(false);
    expect(isInvoiceOverdue("unpaid", TOMORROW, NOW)).toBe(false);
  });

  it("draft, paid and voided invoices are never overdue", () => {
    expect(isInvoiceOverdue("draft", YESTERDAY, NOW)).toBe(false);
    expect(isInvoiceOverdue("paid", YESTERDAY, NOW)).toBe(false);
    expect(isInvoiceOverdue("voided", YESTERDAY, NOW)).toBe(false);
  });
});

describe("isOpenInvoiceStatus", () => {
  it("treats unpaid and partial as open", () => {
    expect(isOpenInvoiceStatus("unpaid")).toBe(true);
    expect(isOpenInvoiceStatus("partial")).toBe(true);
    expect(isOpenInvoiceStatus("draft")).toBe(false);
    expect(isOpenInvoiceStatus("paid")).toBe(false);
    expect(isOpenInvoiceStatus("voided")).toBe(false);
  });
});

describe("INVOICE_STATUS_LABELS", () => {
  it("covers every status", () => {
    expect(INVOICE_STATUS_LABELS.unpaid).toBe("Unpaid");
    expect(INVOICE_STATUS_LABELS.partial).toBe("Partially Paid");
  });
});
