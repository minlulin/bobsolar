import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db';
import { inventoryItems, users } from '@/lib/db/schema';
import { eq, like } from 'drizzle-orm';
import {
  createInventoryItem,
  getInventoryItem,
  updateInventoryItem,
} from '@/actions/inventory-actions';

const databaseUrl = process.env['DATABASE_URL'] ?? '';
const runDbTests = process.env['RUN_DB_TESTS'] === '1';
const describeDb = databaseUrl && runDbTests ? describe : describe.skip;

const authState = vi.hoisted(() => ({
  userId: '',
  role: 'admin' as const,
}));

vi.mock('@/lib/auth/validate', () => ({
  requireAuth: async (): Promise<{
    userId: string;
    role: 'admin' | 'staff';
  }> => {
    if (!authState.userId) {
      throw new Error('Auth context not initialized');
    }

    return await Promise.resolve({
      userId: authState.userId,
      role: authState.role,
    });
  },
  requireAdmin: async (): Promise<{ userId: string; role: 'admin' }> => {
    if (!authState.userId) {
      throw new Error('Auth context not initialized');
    }

    return await Promise.resolve({
      userId: authState.userId,
      role: authState.role,
    });
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describeDb('inventory spec actions', () => {
  const runTag = `inv-spec-${Date.now()}`;
  let userId = '';
  const createdItemIds: string[] = [];

  beforeAll(async () => {
    await db.execute('select 1');

    const [createdUser] = await db
      .insert(users)
      .values({
        email: `${runTag}@example.com`,
        passwordHash: 'test_hash',
        name: 'Inventory Spec Tester',
        role: 'admin',
      })
      .returning({ id: users.id });

    if (!createdUser?.id) {
      throw new Error('Failed to create test user');
    }

    userId = createdUser.id;
    authState.userId = userId;
    authState.role = 'admin';
  });

  afterAll(async () => {
    for (const id of createdItemIds) {
      await db.delete(inventoryItems).where(eq(inventoryItems.id, id));
    }

    await db
      .delete(inventoryItems)
      .where(like(inventoryItems.name, `${runTag}-%`));

    if (userId) {
      await db.delete(users).where(eq(users.id, userId));
    }
  });

  it('creates inventory item with valid specifications', async () => {
    const result = await createInventoryItem({
      name: `${runTag}-panel`,
      category: 'panel',
      unit: 'pcs',
      unitPrice: 345000,
      stockQty: 12,
      brand: 'Jinko',
      modelNumber: 'JKM550',
      specifications: {
        brandModel: 'Jinko JKM550',
        cellType: 'n_type',
        wattageW: 550,
        warranty: '12 years',
      },
      isActive: true,
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(result.error);
    }

    createdItemIds.push(result.data.id);
    expect(result.data.specifications).toEqual({
      brandModel: 'Jinko JKM550',
      cellType: 'n_type',
      wattageW: 550,
      warranty: '12 years',
    });
  });

  it('rejects create inventory item with invalid or missing specs', async () => {
    const result = await createInventoryItem({
      name: `${runTag}-invalid-panel`,
      category: 'panel',
      unit: 'pcs',
      unitPrice: 345000,
      stockQty: 12,
      brand: 'Jinko',
      modelNumber: 'JKM550',
      specifications: {
        brandModel: 'Jinko JKM550',
      },
      isActive: true,
    });

    expect(result.success).toBe(false);
  });

  it('updates item category + specifications together successfully', async () => {
    const created = await createInventoryItem({
      name: `${runTag}-for-update`,
      category: 'panel',
      unit: 'pcs',
      unitPrice: 320000,
      stockQty: 5,
      brand: 'JA',
      modelNumber: 'JA-500',
      specifications: {
        brandModel: 'JA 500',
        cellType: 'p_type',
        wattageW: 500,
        warranty: '10 years',
      },
      isActive: true,
    });

    if (!created.success) {
      throw new Error(created.error);
    }

    createdItemIds.push(created.data.id);

    const updated = await updateInventoryItem(created.data.id, {
      category: 'battery',
      specifications: {
        brandModel: 'Pylontech US3000',
        chemistryType: 'lifepo4',
        voltageV: 51.2,
        capacityAh: 100,
        warranty: '10 years',
      },
    });

    expect(updated.success).toBe(true);
    if (!updated.success) {
      throw new Error(updated.error);
    }
    expect(updated.data.category).toBe('battery');
    expect(updated.data.specifications).toEqual({
      brandModel: 'Pylontech US3000',
      chemistryType: 'lifepo4',
      voltageV: 51.2,
      capacityAh: 100,
      warranty: '10 years',
    });
  });

  it('rejects stale category change without compatible specifications', async () => {
    const created = await createInventoryItem({
      name: `${runTag}-stale-update`,
      category: 'panel',
      unit: 'pcs',
      unitPrice: 310000,
      stockQty: 4,
      brand: 'Trina',
      modelNumber: 'TSM',
      specifications: {
        brandModel: 'Trina 500',
        cellType: 'n_type',
        wattageW: 500,
        warranty: '12 years',
      },
      isActive: true,
    });

    if (!created.success) {
      throw new Error(created.error);
    }

    createdItemIds.push(created.data.id);

    const updated = await updateInventoryItem(created.data.id, {
      category: 'battery',
    });

    expect(updated.success).toBe(false);
  });

  it('reads legacy inventory row with null specifications', async () => {
    const [legacyRow] = await db
      .insert(inventoryItems)
      .values({
        name: `${runTag}-legacy`,
        category: 'accessory',
        unit: 'pcs',
        unitPrice: '10000',
        stockQty: 1,
        brand: null,
        modelNumber: null,
        specifications: null,
        isActive: true,
      })
      .returning({ id: inventoryItems.id });

    if (!legacyRow?.id) {
      throw new Error('Failed to insert legacy row');
    }

    createdItemIds.push(legacyRow.id);

    const result = await getInventoryItem(legacyRow.id);
    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(result.error);
    }
    expect(result.data.specifications).toBeNull();
  });

  it('updates non-spec fields without requiring category/spec pair', async () => {
    const created = await createInventoryItem({
      name: `${runTag}-price-update`,
      category: 'cable',
      unit: 'meter',
      unitPrice: 6000,
      stockQty: 100,
      brand: 'Generic',
      modelNumber: null,
      specifications: {
        cableType: 'dc_cable',
        sizeCrossSection: '6mm2',
        unitOfMeasurement: 'meter',
      },
      isActive: true,
    });

    if (!created.success) {
      throw new Error(created.error);
    }

    createdItemIds.push(created.data.id);

    const updated = await updateInventoryItem(created.data.id, {
      unitPrice: 7000,
      stockQty: 120,
    });

    expect(updated.success).toBe(true);
    if (!updated.success) {
      throw new Error(updated.error);
    }

    expect(updated.data.specifications).toEqual({
      cableType: 'dc_cable',
      sizeCrossSection: '6mm2',
      unitOfMeasurement: 'meter',
    });
    expect(updated.data.unitPrice).toBe('7000');
    expect(updated.data.stockQty).toBe(120);
  });
});
