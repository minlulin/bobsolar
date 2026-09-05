import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";

const state = vi.hoisted(() => ({ authFail: false }));

// biome-ignore lint/suspicious/noExplicitAny: test mock query chain
function selectChain(result: unknown): any {
  // biome-ignore lint/suspicious/noExplicitAny: test mock query chain
  const chain: any = {
    from: () => chain,
    where: () => chain,
    limit: () => chain,
    offset: () => chain,
    orderBy: () => chain,
    innerJoin: () => chain,
    // biome-ignore lint/suspicious/noThenProperty: drizzle select is thenable
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve(result)),
  };
  return chain;
}

vi.mock("@/lib/auth/validate", () => ({
  requireAuth: vi.fn(async () => {
    if (state.authFail) throw new Error("Unauthorized");
    return { userId: "u1", role: "owner" as const };
  }),
  requireOwner: vi.fn(async () => ({ userId: "u1", role: "owner" as const })),
}));

vi.mock("@/lib/db", () => ({ db: { select: vi.fn(() => selectChain([])) } }));

function invoiceRow(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    id: "inv-1",
    invoiceNumber: "INV-20260905-abcd1234",
    projectId: "p1",
    customerId: "c1",
    invoiceDate: new Date("2026-08-01"),
    dueDate: new Date("2026-08-31"),
    status: "unpaid",
    subtotal: "900000",
    taxAmount: "100000",
    total: "1000000",
    paidAmount: "0",
    balanceDue: "1000000",
    createdAt: new Date("2026-09-01"),
    ...overrides,
  };
}

const NOW = new Date("2026-09-05T10:30:00");

describe("getInvoices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.authFail = false;
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("maps rows with computed overdue flags and tab summary", async () => {
    vi.mocked(db.select)
      // items
      .mockImplementationOnce(
        () =>
          selectChain([
            {
              invoice: invoiceRow({ id: "inv-overdue", dueDate: new Date("2026-09-01") }),
              projectNumber: "PJ-2026-0007",
              customerName: "U Thura",
            },
            {
              invoice: invoiceRow({
                id: "inv-paid",
                dueDate: new Date("2026-09-01"),
                status: "paid",
                paidAmount: "1000000",
                balanceDue: "0",
              }),
              projectNumber: "PJ-2026-0002",
              customerName: "Daw Mya",
            },
            {
              invoice: invoiceRow({ id: "inv-draft", status: "draft" }),
              projectNumber: "PJ-2026-0009",
              customerName: "Ko Zaw",
            },
          ]) as never,
      )
      // count
      .mockImplementationOnce(() => selectChain([{ total: 3 }]) as never)
      // summary
      .mockImplementationOnce(
        () =>
          selectChain([
            {
              draft: 1,
              open: 1,
              overdue: 1,
              paid: 1,
              voided: 0,
              openBalanceTotal: "1000000",
            },
          ]) as never,
      );

    const { getInvoices } = await import("@/actions/invoice-actions");
    const res = await getInvoices({ tab: "open" });

    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.total).toBe(3);
    expect(res.data.items).toHaveLength(3);

    const overdue = res.data.items.at(0);
    const paid = res.data.items.at(1);
    const draft = res.data.items.at(2);
    if (!overdue || !paid || !draft) throw new Error("test fixtures missing");

    expect(overdue.id).toBe("inv-overdue");
    expect(overdue.isOverdue).toBe(true);
    expect(overdue.isPosted).toBe(true);
    expect(overdue.total).toBe(1_000_000);
    expect(overdue.balanceDue).toBe(1_000_000);
    expect(overdue.customerName).toBe("U Thura");
    expect(overdue.projectNumber).toBe("PJ-2026-0007");

    expect(paid.isOverdue).toBe(false);
    expect(paid.isPosted).toBe(true);
    expect(paid.balanceDue).toBe(0);

    expect(draft.isPosted).toBe(false);
    expect(draft.isOverdue).toBe(false);

    expect(res.data.summary.open).toBe(1);
    expect(res.data.summary.overdue).toBe(1);
    expect(res.data.summary.openBalanceTotal).toBe(1_000_000);
  });

  it("returns an error response when auth fails", async () => {
    state.authFail = true;
    const { getInvoices } = await import("@/actions/invoice-actions");
    const res = await getInvoices({});
    expect(res.success).toBe(false);
  });

  it("rejects invalid filter input", async () => {
    const { getInvoices } = await import("@/actions/invoice-actions");
    const res = await getInvoices({ tab: "bogus-tab" });
    expect(res.success).toBe(false);
  });
});
