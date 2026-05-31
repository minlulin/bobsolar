import { describe, expectTypeOf, it } from "vitest";
import {
  accountingPeriodStatusEnum,
  journalSourceTypeEnum,
  projectInvoiceStatusEnum,
  purchaseOrderStatusEnum,
  supplierPaymentStatusEnum,
} from "@/lib/db/schema";
import { ACCOUNTING_PERIOD_STATUSES } from "@/lib/domain/accounting-period";
import { JOURNAL_SOURCE_TYPES } from "@/lib/domain/finance";
import { PROJECT_INVOICE_STATUSES } from "@/lib/domain/invoice";
import { PURCHASE_ORDER_STATUSES, SUPPLIER_PAYMENT_STATUSES } from "@/lib/domain/purchase";

describe("SSoT: domain constants match DB enums at type level", () => {
  it("PROJECT_INVOICE_STATUSES matches DB enum", () => {
    expectTypeOf(PROJECT_INVOICE_STATUSES).toEqualTypeOf(projectInvoiceStatusEnum.enumValues);
  });

  it("JOURNAL_SOURCE_TYPES matches DB enum", () => {
    expectTypeOf(JOURNAL_SOURCE_TYPES).toEqualTypeOf(journalSourceTypeEnum.enumValues);
  });

  it("ACCOUNTING_PERIOD_STATUSES matches DB enum", () => {
    expectTypeOf(ACCOUNTING_PERIOD_STATUSES).toEqualTypeOf(accountingPeriodStatusEnum.enumValues);
  });

  it("PURCHASE_ORDER_STATUSES matches DB enum", () => {
    expectTypeOf(PURCHASE_ORDER_STATUSES).toEqualTypeOf(purchaseOrderStatusEnum.enumValues);
  });

  it("SUPPLIER_PAYMENT_STATUSES matches DB enum", () => {
    expectTypeOf(SUPPLIER_PAYMENT_STATUSES).toEqualTypeOf(supplierPaymentStatusEnum.enumValues);
  });
});
