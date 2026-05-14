import { describe, expect, it } from 'vitest';
import { dashboardStatMeta } from '@/app/(dashboard)/dashboard-stat-meta';

describe('dashboard stat metadata', () => {
  it('provides hover description text for every dashboard stat card', () => {
    for (const item of dashboardStatMeta) {
      expect(item.description.trim().length).toBeGreaterThan(0);
    }
  });
});
