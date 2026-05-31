import type { LedgerAccountCode } from "@/lib/domain/finance";

/**
 * Partner Registry SSoT
 * Reads partner config from `SEED_PARTNERS` env var (JSON array).
 * Partners are sorted alphabetically by name and assigned slots A, B, C.
 * Each slot maps to fixed ledger accounts.
 *
 * Env format (set in .env.local or Vercel env secrets):
 *   SEED_PARTNERS=[{"name":"Author","email":"author@bobsolar.com","ownershipPercent":33.34},{"name":"Arkar","email":"arkar@bobsolar.com","ownershipPercent":33.33},{"name":"Yenyeinaung","email":"yenyeinaung@bobsolar.com","ownershipPercent":33.33}]
 */

export type PartnerSlot = "A" | "B" | "C";

export interface PartnerConfig {
  slot: PartnerSlot;
  name: string;
  email: string;
  ownershipPercent: number;
  accounts: {
    capital: LedgerAccountCode;
    draws: LedgerAccountCode;
    distributionsPayable: LedgerAccountCode;
  };
}

/** Fixed ledger account mapping per slot. Slots A, B, C correspond to owner_a, owner_b, owner_c accounts. */
const SLOT_ACCOUNTS: Record<PartnerSlot, PartnerConfig["accounts"]> = {
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

const SLOT_ORDER: PartnerSlot[] = ["A", "B", "C"];

interface SeedPartnerInput {
  name: string;
  email: string;
  ownershipPercent: number;
}

function parsePartnersFromEnv(): PartnerConfig[] {
  const raw = process.env["SEED_PARTNERS"]?.trim();
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("SEED_PARTNERS must be a valid JSON array");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("SEED_PARTNERS must be a JSON array");
  }

  const input: SeedPartnerInput[] = [];
  for (const item of parsed) {
    if (typeof item !== "object" || item === null) {
      throw new Error("Each SEED_PARTNERS entry must be an object");
    }
    const entry = item as Record<string, unknown>;
    if (typeof entry["name"] !== "string") {
      throw new Error("Each SEED_PARTNERS entry needs 'name' as string");
    }
    if (typeof entry["email"] !== "string") {
      throw new Error("Each SEED_PARTNERS entry needs 'email' as string");
    }
    if (typeof entry["ownershipPercent"] !== "number") {
      throw new Error("Each SEED_PARTNERS entry needs 'ownershipPercent' as number");
    }
    input.push({
      name: entry["name"],
      email: entry["email"],
      ownershipPercent: entry["ownershipPercent"],
    });
  }

  // Sort alphabetically by name, assign slots A, B, C
  input.sort((a, b) => a.name.localeCompare(b.name));

  if (input.length > SLOT_ORDER.length) {
    throw new Error(`Maximum ${SLOT_ORDER.length} partners supported. Got ${input.length}.`);
  }

  return input.map((item, i) => {
    const slot = SLOT_ORDER[i];
    if (!slot) throw new Error(`No slot available for partner index ${i}`);
    return {
      slot,
      name: item.name,
      email: item.email,
      ownershipPercent: item.ownershipPercent,
      accounts: SLOT_ACCOUNTS[slot],
    };
  });
}

/** Partner configuration — loaded from SEED_PARTNERS env var. Empty if not set. */
export const PARTNERS: PartnerConfig[] = parsePartnersFromEnv();

/** Total ownership must equal 100% (only when partners are configured). */
if (PARTNERS.length > 0) {
  const totalPercent = PARTNERS.reduce((sum, p) => sum + p.ownershipPercent, 0);
  if (Math.round(totalPercent * 100) !== 10000) {
    throw new Error(`Partner ownership must total 100%. Current total: ${totalPercent}%`);
  }
}

/** Lookup a partner by slot. */
export function getPartnerBySlot(slot: PartnerSlot): PartnerConfig | undefined {
  return PARTNERS.find((p) => p.slot === slot);
}

/** Lookup a partner by email. */
export function getPartnerByEmail(email: string): PartnerConfig | undefined {
  return PARTNERS.find((p) => p.email === email);
}

/** Lookup a partner's ledger accounts by email. */
export function getPartnerAccountsByEmail(email: string): PartnerConfig["accounts"] | undefined {
  return getPartnerByEmail(email)?.accounts;
}

/** Distribute an amount across all partners based on ownership %. */
export function calculateDistributionShares(
  totalAmount: number,
): Array<{ partner: PartnerConfig; amount: number }> {
  return PARTNERS.map((partner) => ({
    partner,
    amount: Math.round(totalAmount * (partner.ownershipPercent / 100)),
  }));
}
