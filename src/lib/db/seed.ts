import { db } from './index';
import { users, companySettings } from './schema';
import { hashPassword } from '../auth/password';

async function seed() {
  console.log('🌱 Seeding database...');

  // 1. Seed Admin User
  const adminPassword = await hashPassword('admin123');
  await db.insert(users).values({
    email: 'admin@bobsolar.com',
    passwordHash: adminPassword,
    name: 'Admin User',
    role: 'admin',
  }).onConflictDoNothing();

  // 2. Seed Company Settings
  await db.insert(companySettings).values([
    { key: 'company_name', value: 'BOB Solar' },
    { key: 'company_address', value: 'No. 123, Solar Street, Yangon' },
    { key: 'company_phone', value: '+95 9 123 456 789' },
  ]).onConflictDoNothing();

  console.log('✅ Seeding completed!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
