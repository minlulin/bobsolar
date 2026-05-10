import { db } from './index';
import { users, companySettings, warrantyAlerts } from './schema';
import { hashPassword } from '../auth/password';
import { COMPANY_SETTING_KEYS } from '../domain/settings-keys';

// Read admin credentials from environment variables
const SEED_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL;
const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD;

// List of weak/default passwords to reject
const WEAK_PASSWORDS = ['admin123', 'password', '123456', 'admin', 'qwerty'];

async function seed() {
  console.log('🌱 Seeding database...');

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
    .onConflictDoNothing();

  console.log(`✅ Admin user created: ${SEED_ADMIN_EMAIL}`);

  // 2. Seed Company Settings
  await db
    .insert(companySettings)
    .values([
      { key: COMPANY_SETTING_KEYS.NAME, value: 'BOB Solar' },
      { key: COMPANY_SETTING_KEYS.ADDRESS, value: 'No. 123, Solar Street, Yangon' },
      { key: COMPANY_SETTING_KEYS.PHONE, value: '+95 9 123 456 789' },
    ])
    .onConflictDoNothing();

  // Keep warranty alerts deterministic across repeated seeds.
  await db.delete(warrantyAlerts);

  console.log('✅ Seeding completed!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
