import { describe, expect, it } from "vitest";
import {
  JOURNAL_SOURCE_TYPES,
  journalSourceTypeSchema,
  LEDGER_ACCOUNT_CODE_TYPE_MAP,
  LEDGER_ACCOUNT_CODES,
  LEDGER_ACCOUNT_TYPES,
  ledgerAccountCodeSchema,
  ledgerAccountTypeSchema,
} from "@/lib/domain/finance";
import {
  PAYMENT_COLLECTION_STATUSES,
  PAYMENT_METHOD_PRESETS,
  paymentCollectionStatusSchema,
  paymentMethodPresetSchema,
} from "@/lib/domain/payment";

describe("finance ssot: payment methods", () => {
  it("contains accepted real-world methods", () => {
    expect(PAYMENT_METHOD_PRESETS).toEqual([
      "cash",
      "kbz_pay",
      "kbz_banking",
      "aya_pay",
      "aya_banking",
      "cb_pay",
      "cb_banking",
      "wave_pay",
    ]);
  });

  it("validates and rejects method values correctly", () => {
    expect(paymentMethodPresetSchema.safeParse("cash").success).toBe(true);
    expect(paymentMethodPresetSchema.safeParse("mobile_wallet").success).toBe(false);
  });
});

describe("finance ssot: collection statuses", () => {
  it("contains advance lifecycle statuses", () => {
    expect(PAYMENT_COLLECTION_STATUSES).toEqual(["advance", "partial", "fully_paid"]);
  });

  it("validates and rejects collection status values correctly", () => {
    expect(paymentCollectionStatusSchema.safeParse("partial").success).toBe(true);
    expect(paymentCollectionStatusSchema.safeParse("unpaid").success).toBe(false);
  });
});

describe("finance ssot: double-entry taxonomy", () => {
  it("exposes all root account types", () => {
    expect(LEDGER_ACCOUNT_TYPES).toEqual(["asset", "liability", "equity", "income", "expense"]);
    expect(ledgerAccountTypeSchema.safeParse("asset").success).toBe(true);
    expect(ledgerAccountTypeSchema.safeParse("unknown").success).toBe(false);
  });

  it("maps every account code to one account type", () => {
    for (const code of LEDGER_ACCOUNT_CODES) {
      const mapped = LEDGER_ACCOUNT_CODE_TYPE_MAP[code];
      expect(mapped).toBeDefined();
      expect(LEDGER_ACCOUNT_TYPES.includes(mapped)).toBe(true);
      expect(ledgerAccountCodeSchema.safeParse(code).success).toBe(true);
    }
  });
});

describe("finance ssot: journal sources", () => {
  it("includes operational and migration sources", () => {
    expect(JOURNAL_SOURCE_TYPES).toContain("project_payment");
    expect(JOURNAL_SOURCE_TYPES).toContain("project_expense");
    expect(JOURNAL_SOURCE_TYPES).toContain("backfill");
  });

  it("validates and rejects source values correctly", () => {
    expect(journalSourceTypeSchema.safeParse("manual_adjustment").success).toBe(true);
    expect(journalSourceTypeSchema.safeParse("unknown_source").success).toBe(false);
  });
});
