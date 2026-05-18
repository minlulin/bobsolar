/**
 * Safe number parsing utilities
 */

export function parsePositiveInteger(value: string | number): number {
  if (typeof value === "number") return value;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
}

export function parseNonNegativeNumber(value: string | number): number {
  if (typeof value === "number") return value;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
}

export function parsePercentage(value: string | number): number {
  if (typeof value === "number") return value;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? 0 : Math.max(0, Math.min(100, parsed));
}

export function formatNumberInput(value: string): string {
  return value.replace(/[^0-9.]/g, "");
}
