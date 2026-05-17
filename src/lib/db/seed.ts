import './load-env-local';
import { db } from './index';
import { users, companySettings, warrantyAlerts } from './schema';
import { hashPassword } from '../auth/password';
import { COMPANY_SETTING_KEYS } from '../domain/settings-keys';
import { getSeedAdminCredentials } from './seed-config';

// Admin and seed data: read only from .env.local (loaded by ./load-env-local)
const { email: rawEmail, password: SEED_ADMIN_PASSWORD } =
  getSeedAdminCredentials();
const SEED_ADMIN_EMAIL = rawEmail?.trim();
const SEED_COMPANY_EMAIL = process.env['SEED_COMPANY_EMAIL']?.trim();
const ALLOW_PROD_SEED = process.env['ALLOW_PROD_SEED'] === '1';
const SEED_RESET_ALERTS = process.env['SEED_RESET_ALERTS'] === '1';

// Extra users from SEED_USERS JSON array env var
type SeedUser = {
  email: string;
  password: string;
  name?: string;
  role?: string;
};
function parseExtraUsers(): SeedUser[] {
  const raw = process.env['SEED_USERS']?.trim();
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed))
      throw new Error('SEED_USERS must be a JSON array');
    const users: SeedUser[] = [];
    for (const u of parsed) {
      if (typeof u !== 'object' || u === null) {
        throw new Error('Each SEED_USERS entry must be an object');
      }
      const entry = u as Record<string, unknown>;
      if (
        typeof entry['email'] !== 'string' ||
        typeof entry['password'] !== 'string'
      ) {
        throw new Error(
          'Each SEED_USERS entry needs email and password as strings',
        );
      }
      const name =
        typeof entry['name'] === 'string' ? entry['name'] : undefined;
      const role =
        typeof entry['role'] === 'string' ? entry['role'] : undefined;
      users.push({
        email: entry['email'],
        password: entry['password'],
        ...(name !== undefined ? { name } : {}),
        ...(role !== undefined ? { role } : {}),
      });
    }
    return users;
  } catch {
    console.error('❌ Invalid SEED_USERS format. Expected JSON array:');
    console.error(
      '   [{"email":"user","password":"pass","name":"Name","role":"staff"}]',
    );
    process.exit(1);
  }
}

const SEED_EXTRA_USERS = parseExtraUsers();

// List of weak/default passwords to reject
const WEAK_PASSWORDS = ['admin123', 'password', '123456', 'admin', 'qwerty'];

if (process.env['NODE_ENV'] === 'production' && !ALLOW_PROD_SEED) {
  throw new Error(
    'Refusing to run seed in production. Set ALLOW_PROD_SEED=1 to override.',
  );
}

async function seed(): Promise<void> {
  console.log('🌱 Seeding database...');

  if (!process.env['DATABASE_URL']?.trim()) {
    console.error(
      '❌ DATABASE_URL is not set. Add your connection string to .env.local.',
    );
    process.exit(1);
  }

  // Validate environment variables
  if (!SEED_ADMIN_EMAIL || !SEED_ADMIN_PASSWORD) {
    console.error('❌ Missing required environment variables:');
    console.error('   - SEED_ADMIN_EMAIL');
    console.error('   - SEED_ADMIN_PASSWORD');
    process.exit(1);
  }

  // Reject weak/default passwords
  const lowerPassword = SEED_ADMIN_PASSWORD.toLowerCase();
  if (
    WEAK_PASSWORDS.includes(lowerPassword) ||
    SEED_ADMIN_PASSWORD.length < 8
  ) {
    console.error(
      '❌ Weak or default password detected. Please use a strong password (min 8 chars).',
    );
    process.exit(1);
  }

  // 1. Seed Admin User
  const adminPassword = await hashPassword(SEED_ADMIN_PASSWORD);
  await db
    .insert(users)
    .values({
      email: SEED_ADMIN_EMAIL,
      passwordHash: adminPassword,
      name: 'Admin User',
      role: 'admin',
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { passwordHash: adminPassword, name: 'Admin User' },
    });

  console.log(`✅ Admin user created: ${SEED_ADMIN_EMAIL}`);

  // 1b. Seed Extra Users (from SEED_USERS JSON array)
  for (const extra of SEED_EXTRA_USERS) {
    const pwHash = await hashPassword(extra.password);
    await db
      .insert(users)
      .values({
        email: extra.email.trim(),
        passwordHash: pwHash,
        name: extra.name?.trim() || extra.email.trim(),
        role: (extra.role?.trim() as 'admin' | 'staff' | undefined) ?? 'staff',
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          passwordHash: pwHash,
          name: extra.name?.trim() || extra.email.trim(),
        },
      });
    console.log(`  └─ User "${extra.email}" seeded`);
  }
  if (SEED_EXTRA_USERS.length > 0) {
    console.log(`✅ ${SEED_EXTRA_USERS.length} extra user(s) created`);
  }

  const companyContactEmail = SEED_COMPANY_EMAIL || SEED_ADMIN_EMAIL;

  // 2. Seed Company Settings (identity fields from env where sensitive / site-specific)
  await db
    .insert(companySettings)
    .values([
      { key: COMPANY_SETTING_KEYS.NAME, value: 'BOB Solar' },
      {
        key: COMPANY_SETTING_KEYS.ADDRESS,
        value: 'No. 123, Solar Street, Yangon',
      },
      { key: COMPANY_SETTING_KEYS.PHONE, value: '+95 9 123 456 789' },
      { key: COMPANY_SETTING_KEYS.EMAIL, value: companyContactEmail },
    ])
    .onConflictDoNothing();

  if (SEED_RESET_ALERTS) {
    // Keep warranty alerts deterministic across repeated seeds.
    await db.delete(warrantyAlerts);
  }

  console.log('✅ Seeding completed!');
  process.exit(0);
}

seed().catch((err: unknown) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
