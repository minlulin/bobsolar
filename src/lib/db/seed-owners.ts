import "@/lib/db/load-env-local";
import { eq } from "drizzle-orm";
import { PARTNERS } from "../domain/partners";
import { db } from "./index";
import { owners, users } from "./schema";

/**
 * Seed the owners table from SEED_PARTNERS env var.
 * Run with: pnpm tsx src/lib/db/seed-owners.ts
 *
 * Requires SEED_PARTNERS env var to be set (JSON array).
 * Looks up each partner by email, inserts into owners table.
 * Safe to re-run (skips existing owners).
 */
async function seedOwners(): Promise<void> {
  if (PARTNERS.length === 0) {
    console.error(
      "❌ SEED_PARTNERS env var is not set. Add it to .env.local or Vercel env secrets.",
    );
    console.error(
      '   Format: [{"name":"Author","email":"author@bobsolar.com","ownershipPercent":33.34}, ...]',
    );
    process.exit(1);
  }

  console.log(`🌱 Seeding ${PARTNERS.length} owner(s) from SEED_PARTNERS...`);

  for (const partner of PARTNERS) {
    const user = await db.query.users.findFirst({
      where: eq(users.email, partner.email),
      columns: { id: true, name: true },
    });

    if (!user) {
      console.error(`  ❌ User not found: ${partner.email} (${partner.name})`);
      console.error(`     Create this user first via SEED_USERS env var or the app.`);
      continue;
    }

    const [existing] = await db
      .select({ id: owners.id })
      .from(owners)
      .where(eq(owners.userId, user.id))
      .limit(1);

    if (existing) {
      console.log(`  ⏭️  Owner already exists: ${partner.name} (slot ${partner.slot})`);
      continue;
    }

    await db.insert(owners).values({
      userId: user.id,
      ownershipPercentage: String(partner.ownershipPercent),
    });

    console.log(
      `  ✅ Owner created: ${partner.name} (slot ${partner.slot}, ${partner.ownershipPercent}%)`,
    );
  }

  console.log("✅ Owners seeding completed!");
}

seedOwners().catch((err: unknown) => {
  console.error("❌ Owners seeding failed:", err);
  process.exit(1);
});
