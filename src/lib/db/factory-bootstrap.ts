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
} from "@/lib/domain/finance";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_PRESETS } from "@/lib/domain/payment";
import { COMPANY_SETTING_KEYS } from "@/lib/domain/settings-keys";
import { db } from "./index";
import { companySettings, ledgerAccounts, paymentMethods } from "./schema";

async function main(): Promise<void> {
  console.log("Seeding factory bootstrap data...");

  const settings: { key: string; value: string }[] = [
    { key: COMPANY_SETTING_KEYS.NAME, value: "BOB Solar" },
    { key: COMPANY_SETTING_KEYS.ADDRESS, value: "Yangon, Myanmar" },
    { key: COMPANY_SETTING_KEYS.PHONE, value: "+95-1-234567" },
    { key: COMPANY_SETTING_KEYS.EMAIL, value: "info@bobsolar.com" },
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
    await db
      .insert(paymentMethods)
      .values(method)
      .onConflictDoNothing({ target: paymentMethods.name });
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
