/**
 * Factory Bootstrap: Minimal clean data for handoff.
 *
 * Seeds only:
 * - Default company settings
 * - Default payment methods
 * - Master ledger accounts
 *
 * No test data, no sample customers/projects/quotations.
 */

import "./load-env-local";
import {
  LEDGER_ACCOUNT_CODE_TYPE_MAP,
  LEDGER_ACCOUNT_CODES,
  LEDGER_ACCOUNT_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_PRESETS,
} from "@/lib/domain/enums";
import { db } from "./index";
import { companySettings, ledgerAccounts, paymentMethods } from "./schema";

async function main(): Promise<void> {
  console.log("Seeding factory bootstrap data...");

  const settings: { key: string; value: string }[] = [
    { key: "company_name", value: "BOB Solar" },
    { key: "company_address", value: "Yangon, Myanmar" },
    { key: "company_phone", value: "+95-1-234567" },
    { key: "company_email", value: "info@bobsolar.com" },
  ];

  for (const setting of settings) {
    await db
      .insert(companySettings)
      .values(setting)
      .onConflictDoUpdate({
        target: companySettings.key,
        set: { value: setting.value },
      });
  }

  console.log("Company settings seeded");

  const methods = PAYMENT_METHOD_PRESETS.map((method) => ({
    name: PAYMENT_METHOD_LABELS[method],
  }));

  for (const method of methods) {
    await db.insert(paymentMethods).values(method).onConflictDoNothing();
  }

  console.log("Payment methods seeded");

  const accounts = LEDGER_ACCOUNT_CODES.map((code) => ({
    code,
    name: LEDGER_ACCOUNT_LABELS[code],
    type: LEDGER_ACCOUNT_CODE_TYPE_MAP[code],
    isActive: true,
  }));

  await db.insert(ledgerAccounts).values(accounts).onConflictDoNothing();

  console.log("Ledger accounts seeded");
  console.log("Factory bootstrap complete.");
}

main().catch((error: unknown) => {
  console.error("Bootstrap failed:", error);
  process.exit(1);
});
