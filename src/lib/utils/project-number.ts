/**
 * Project number pattern: PJ-{YEAR}-{SEQUENCE}
 * Example: PJ-2026-0001
 */
export function formatProjectNumber(sequence: number, year?: number): string {
  const y = year ?? new Date().getFullYear();
  return `PJ-${y}-${sequence.toString().padStart(4, '0')}`;
}

export function extractProjectSequence(projectNumber: string | undefined): number {
  if (!projectNumber) return 0;
  const parts = projectNumber.split('-');
  if (parts.length < 3) return 0;
  const seq = parts[2];
  if (!seq) return 0;
  return parseInt(seq, 10) || 0;
}
