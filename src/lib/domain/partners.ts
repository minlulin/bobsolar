import type { LedgerAccountCode } from "@/lib/domain/finance";

/**
 * Partner Slot → Ledger Accounts (SSoT)
 *
 * Each slot (A, B, C) maps to a fixed set of equity ledger accounts. The
 * slot is persisted on the `owners` row (assigned automatically at creation
 * time: the lowest available slot). Slot-to-account mapping is static and
 * does not change at runtime — renaming an owner does not change their
 * slot, and archiving an owner frees their slot for the next one.
 *
 * If more than 3 owners are ever needed, additional slots (D, E, ...) and
 * corresponding ledger accounts must be added in a migration.
 */

export type PartnerSlot = "A" | "B" | "C";

export const PARTNER_SLOTS: readonly PartnerSlot[] = ["A", "B", "C"] as const;

export type PartnerAccounts = {
  capital: LedgerAccountCode;
  draws: LedgerAccountCode;
  distributionsPayable: LedgerAccountCode;
};

const SLOT_ACCOUNTS: Record<PartnerSlot, PartnerAccounts> = {
  A: {
    capital: "owner_a_capital",
    draws: "owner_a_draws",
    distributionsPayable: "owner_a_distributions_payable",
  },
  B: {
    capital: "owner_b_capital",
    draws: "owner_b_draws",
    distributionsPayable: "owner_b_distributions_payable",
  },
  C: {
    capital: "owner_c_capital",
    draws: "owner_c_draws",
    distributionsPayable: "owner_c_distributions_payable",
  },
};

/** Get the ledger accounts for a given slot. Throws if the slot is invalid. */
export function getPartnerAccountsBySlot(slot: string): PartnerAccounts {
  const accounts = SLOT_ACCOUNTS[slot as PartnerSlot];
  if (!accounts) {
    throw new Error(
      `Unknown partner slot: "${slot}". Valid slots: ${PARTNER_SLOTS.join(", ")}. ` +
        `Add the slot's ledger accounts in src/lib/domain/partners.ts before using it.`,
    );
  }
  return accounts;
}
