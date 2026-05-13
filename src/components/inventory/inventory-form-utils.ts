import type { InventoryCategory } from '@/lib/db/schema';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function deriveInventoryName(
  category: InventoryCategory,
  specifications: unknown,
  fallbackName: string,
): string {
  const trimmedFallback = fallbackName.trim();
  if (!isRecord(specifications)) {
    return trimmedFallback.length > 0 ? trimmedFallback : `${category} item`;
  }
  if (
    (category === 'panel' ||
      category === 'inverter' ||
      category === 'battery') &&
    typeof specifications['brandModel'] === 'string' &&
    specifications['brandModel'].trim().length > 0
  ) {
    return specifications['brandModel'].trim();
  }
  if (
    (category === 'mounting' || category === 'accessory') &&
    typeof specifications['type'] === 'string' &&
    specifications['type'].trim().length > 0
  ) {
    return specifications['type'].trim();
  }
  if (
    category === 'cable' &&
    typeof specifications['sizeCrossSection'] === 'string' &&
    specifications['sizeCrossSection'].trim().length > 0
  ) {
    return specifications['sizeCrossSection'].trim();
  }
  return trimmedFallback.length > 0 ? trimmedFallback : `${category} item`;
}

export function formatNumericInputValue(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value) || value === 0) return '';
  return String(value);
}

export function parseNumericInput(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function extractSpecErrorMessage(specErrors: unknown): string | null {
  if (!isRecord(specErrors)) return null;

  for (const value of Object.values(specErrors)) {
    if (isRecord(value) && typeof value['message'] === 'string') {
      return value['message'];
    }
    const nested = extractSpecErrorMessage(value);
    if (nested) return nested;
  }
  return null;
}
