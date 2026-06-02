import { describe, expectTypeOf, it } from "vitest";
import {
  accountingPeriodStatusEnum,
  inventoryCategoryEnum,
  inventoryUnitEnum,
  journalSourceTypeEnum,
  ownerTransactionStatusEnum,
  ownerTransactionTypeEnum,
  projectInvoiceStatusEnum,
  projectStatusEnum,
  purchaseOrderStatusEnum,
  quotationStatusEnum,
  supplierPaymentStatusEnum,
} from "@/lib/db/schema";
import { ACCOUNTING_PERIOD_STATUSES } from "@/lib/domain/accounting-period";
import { JOURNAL_SOURCE_TYPES } from "@/lib/domain/finance";
import { INVENTORY_CATEGORIES, INVENTORY_UNITS } from "@/lib/domain/inventory";
import { PROJECT_INVOICE_STATUSES } from "@/lib/domain/invoice";
import {
  OWNER_TRANSACTION_STATUSES,
  OWNER_TRANSACTION_TYPES,
} from "@/lib/domain/owner-transaction";
import { PROJECT_STATUSES } from "@/lib/domain/project";
import { PURCHASE_ORDER_STATUSES, SUPPLIER_PAYMENT_STATUSES } from "@/lib/domain/purchase";
import { QUOTATION_STATUSES } from "@/lib/domain/quotation";

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

  it("PROJECT_STATUSES matches DB enum", () => {
    expectTypeOf(PROJECT_STATUSES).toEqualTypeOf(projectStatusEnum.enumValues);
  });

  it("QUOTATION_STATUSES matches DB enum", () => {
    expectTypeOf(QUOTATION_STATUSES).toEqualTypeOf(quotationStatusEnum.enumValues);
  });

  it("INVENTORY_CATEGORIES matches DB enum", () => {
    expectTypeOf(INVENTORY_CATEGORIES).toEqualTypeOf(inventoryCategoryEnum.enumValues);
  });

  it("INVENTORY_UNITS matches DB enum", () => {
    expectTypeOf(INVENTORY_UNITS).toEqualTypeOf(inventoryUnitEnum.enumValues);
  });

  it("OWNER_TRANSACTION_TYPES matches DB enum", () => {
    expectTypeOf(OWNER_TRANSACTION_TYPES).toEqualTypeOf(ownerTransactionTypeEnum.enumValues);
  });

  it("OWNER_TRANSACTION_STATUSES matches DB enum", () => {
    expectTypeOf(OWNER_TRANSACTION_STATUSES).toEqualTypeOf(ownerTransactionStatusEnum.enumValues);
  });
});
