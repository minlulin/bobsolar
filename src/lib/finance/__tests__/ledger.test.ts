import { describe, expect, it } from "vitest";
import {
  assertFinanceSsotDrift,
  mapCostTypeToExpenseAccount,
  mapPaymentMethodNameToAssetAccount,
} from "@/lib/finance/ledger";

describe("ledger payment mapping", () => {
  it("maps supported payment method names to asset accounts", () => {
    expect(mapPaymentMethodNameToAssetAccount("Cash")).toBe("cash_on_hand");
    expect(mapPaymentMethodNameToAssetAccount("KBZ Pay")).toBe("kbz_wallet");
    expect(mapPaymentMethodNameToAssetAccount("Wave Pay")).toBe("wave_wallet");
    expect(mapPaymentMethodNameToAssetAccount("AYA Pay")).toBe("aya_wallet");
    expect(mapPaymentMethodNameToAssetAccount("Bank Transfer")).toBe("bank_account");
  });

  it("returns null for unknown methods", () => {
    expect(mapPaymentMethodNameToAssetAccount("Cheque")).toBeNull();
  });
});

describe("ledger cost mapping", () => {
  it("maps cost types to expense accounts", () => {
    expect(mapCostTypeToExpenseAccount("material")).toBe("material_expense");
    expect(mapCostTypeToExpenseAccount("labor")).toBe("labor_expense");
    expect(mapCostTypeToExpenseAccount("transport")).toBe("transport_expense");
    expect(mapCostTypeToExpenseAccount("misc")).toBe("misc_expense");
    expect(mapCostTypeToExpenseAccount("general")).toBe("general_expense");
  });
});

describe("finance ssot drift assertion", () => {
  it("passes for current SSoT setup", () => {
    expect(() => {
      assertFinanceSsotDrift();
    }).not.toThrow();
  });
});
