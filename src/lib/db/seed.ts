import "./load-env-local";
import { hashPassword } from "../auth/password";
import { COMPANY_SETTING_KEYS } from "../domain/settings-keys";
import { db } from "./index";
import { companySettings, users, warrantyAlerts } from "./schema";
import { getSeedAdminCredentials } from "./seed-config";

// Admin: read only from .env.local (loaded by ./load-env-local).
// Partners are NOT seeded here — they are created in-app via
// Settings → Partners after handover.
const { email: rawEmail, password: SEED_ADMIN_PASSWORD } = getSeedAdminCredentials();
const SEED_ADMIN_EMAIL = rawEmail?.trim();
const SEED_COMPANY_EMAIL = process.env["SEED_COMPANY_EMAIL"]?.trim();
const ALLOW_PROD_SEED = process.env["ALLOW_PROD_SEED"] === "1";
const SEED_RESET_ALERTS = process.env["SEED_RESET_ALERTS"] === "1";

// Weak/default passwords to reject.
const WEAK_PASSWORDS = ["admin123", "password", "123456", "admin", "qwerty"];

if (process.env.NODE_ENV === "production" && !ALLOW_PROD_SEED) {
  throw new Error("Refusing to run seed in production. Set ALLOW_PROD_SEED=1 to override.");
}

async function seed(): Promise<void> {
  console.log("Seeding database...");

  if (!process.env["DATABASE_URL"]?.trim()) {
    console.error("DATABASE_URL is not set. Add your connection string to .env.local.");
    process.exit(1);
  }

  if (!SEED_ADMIN_EMAIL || !SEED_ADMIN_PASSWORD) {
    console.error("Missing required environment variables:");
    console.error("  - SEED_ADMIN_EMAIL");
    console.error("  - SEED_ADMIN_PASSWORD");
    process.exit(1);
  }

  const lowerPassword = SEED_ADMIN_PASSWORD.toLowerCase();
  if (WEAK_PASSWORDS.includes(lowerPassword) || SEED_ADMIN_PASSWORD.length < 8) {
    console.error("Weak or default password detected. Please use a strong password (min 8 chars).");
    process.exit(1);
  }

  // 1. Seed Admin User
  const adminPassword = await hashPassword(SEED_ADMIN_PASSWORD);
  await db
    .insert(users)
    .values({
      email: SEED_ADMIN_EMAIL,
      passwordHash: adminPassword,
      name: "Admin User",
      role: "admin",
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { passwordHash: adminPassword, name: "Admin User" },
    });

  console.log(`Admin user created: ${SEED_ADMIN_EMAIL}`);

  const companyContactEmail = SEED_COMPANY_EMAIL || SEED_ADMIN_EMAIL;

  // 2. Seed Company Settings (identity fields from env where sensitive / site-specific)
  await db
    .insert(companySettings)
    .values([
      { key: COMPANY_SETTING_KEYS.NAME, value: "BOB Solar" },
      {
        key: COMPANY_SETTING_KEYS.ADDRESS,
        value: "No. 123, Solar Street, Yangon",
      },
      { key: COMPANY_SETTING_KEYS.PHONE, value: "+95 9 123 456 789" },
      { key: COMPANY_SETTING_KEYS.EMAIL, value: companyContactEmail },
    ])
    .onConflictDoNothing();

  if (SEED_RESET_ALERTS) {
    await db.delete(warrantyAlerts);
  }

  console.log("Seeding completed! Owners must be added in-app via Settings → Partners.");
  process.exit(0);
}

seed().catch((err: unknown) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
