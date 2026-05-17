/**
 * Factory Bootstrap: Minimal clean data for handoff.
 *
 * Seeds only:
 * - 1 admin user
 * - Default company settings
 * - Default payment methods
 *
 * No test data, no sample customers/projects/quotations.
 */

import './load-env-local';
import { db } from './index';
import { users, companySettings, paymentMethods } from './schema';
import { hashPassword } from '@/lib/auth/password';

async function main(): Promise<void> {
  console.log('Seeding factory bootstrap data…');

  const passwordHash = await hashPassword('admin123');

  await db.insert(users).values({
    email: 'admin@bobsolar.com',
    passwordHash,
    name: 'Admin',
    role: 'admin',
  });

  console.log('✓ Admin user created');

  const settings: { key: string; value: string }[] = [
    { key: 'company_name', value: 'BOB Solar' },
    { key: 'company_address', value: 'Yangon, Myanmar' },
    { key: 'company_phone', value: '+95-1-234567' },
    { key: 'company_email', value: 'info@bobsolar.com' },
  ];

  for (const s of settings) {
    await db
      .insert(companySettings)
      .values(s)
      .onConflictDoUpdate({
        target: companySettings.key,
        set: { value: s.value },
      });
  }

  console.log('✓ Company settings seeded');

  const methods: { name: string }[] = [
    { name: 'Cash' },
    { name: 'Bank Transfer' },
    { name: 'Mobile Wallet' },
    { name: 'Cheque' },
    { name: 'Other' },
  ];

  for (const m of methods) {
    await db.insert(paymentMethods).values(m);
  }

  console.log('✓ Payment methods seeded');
  console.log('Factory bootstrap complete.');
}

main().catch((err: unknown) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
