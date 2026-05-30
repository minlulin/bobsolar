import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertJournalEntryNotReversed,
  createBalancedJournalEntry,
  ensureLedgerAccountsSeeded,
  getJournalEntryWithLines,
  reverseJournalEntry,
} from "@/lib/finance/ledger";

describe("ledger db-heavy branches", () => {
  // biome-ignore lint/suspicious/noExplicitAny: drizzle transaction mock
  const tx: any = {};

  beforeEach(() => {
    vi.clearAllMocks();
    tx.select = vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => []) })) }));
    tx.insert = vi.fn(() => ({
      values: vi.fn((payload: unknown) => {
        if (Array.isArray(payload)) return Promise.resolve();
        return { returning: vi.fn(async () => [{ id: "entry-1" }]) };
      }),
    }));
    tx.query = {
      journalEntries: {
        findFirst: vi.fn(async () => null),
      },
      accountingPeriods: {
        findFirst: vi.fn(async () => null),
      },
    };
    tx.update = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) }));
  });

  it("ensureLedgerAccountsSeeded inserts missing codes", async () => {
    await ensureLedgerAccountsSeeded(tx);
    expect(tx.insert).toHaveBeenCalled();
  });

  it("createBalancedJournalEntry succeeds on balanced lines", async () => {
    tx.select = vi
      .fn()
      .mockReturnValueOnce({ from: vi.fn(() => ({ where: vi.fn(async () => []) })) })
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(async () => [
            { id: "a1", code: "cash_on_hand", isActive: true },
            { id: "a2", code: "accounts_receivable", isActive: true },
          ]),
        })),
      });

    const res = await createBalancedJournalEntry({
      tx,
      sourceType: "manual_adjustment",
      sourceId: "s1",
      createdBy: "u1",
      lines: [
        { accountCode: "cash_on_hand", debit: 100, credit: 0 },
        { accountCode: "accounts_receivable", debit: 0, credit: 100 },
      ],
    });

    expect(res.entryId).toBe("entry-1");
  });

  it("getJournalEntryWithLines maps numeric strings", async () => {
    tx.query.journalEntries.findFirst = vi.fn(async () => ({
      id: "e1",
      sourceType: "project_payment",
      sourceId: "p1",
      memo: null,
      createdBy: "u1",
      entryDate: new Date(),
      lines: [
        {
          id: "l1",
          accountId: "a1",
          debit: "100",
          credit: "0",
          memo: "memo",
          account: { id: "a1", code: "cash_on_hand" },
        },
      ],
    }));

    const row = await getJournalEntryWithLines(tx, "e1");
    expect(row?.lines[0]?.debit).toBe(100);
    expect(row?.lines[0]?.accountCode).toBe("cash_on_hand");
  });

  it("reverseJournalEntry creates reversal and marks original reversed", async () => {
    // biome-ignore lint/suspicious/noExplicitAny: drizzle query mock
    tx.query.journalEntries.findFirst = vi.fn(async (args?: any) => {
      if (args?.columns) return { isReversed: false };
      return {
        id: "e1",
        sourceType: "project_payment",
        sourceId: "p1",
        memo: "orig",
        createdBy: "u1",
        entryDate: new Date(),
        lines: [
          {
            id: "l1",
            accountId: "a1",
            debit: "100",
            credit: "0",
            memo: null,
            account: { id: "a1", code: "cash_on_hand" },
          },
          {
            id: "l2",
            accountId: "a2",
            debit: "0",
            credit: "100",
            memo: null,
            account: { id: "a2", code: "accounts_receivable" },
          },
        ],
      };
    });
    tx.select = vi
      .fn()
      .mockReturnValueOnce({ from: vi.fn(() => ({ where: vi.fn(async () => []) })) })
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(async () => [
            { id: "a1", code: "cash_on_hand", isActive: true },
            { id: "a2", code: "accounts_receivable", isActive: true },
          ]),
        })),
      });

    const res = await reverseJournalEntry({ tx, originalEntryId: "e1", createdBy: "u1" });
    expect(res.entryId).toBe("entry-1");
  });

  it("assertJournalEntryNotReversed throws when already reversed", async () => {
    tx.query.journalEntries.findFirst = vi.fn(async () => ({ isReversed: true }));
    await expect(assertJournalEntryNotReversed(tx, "e1")).rejects.toThrow("already been reversed");
  });
});
