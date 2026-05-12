/**
 * Generates a formatted quote number.
 * Pattern: QT-{YEAR}-{SEQUENCE}
 * Example: QT-2026-0001
 */
export function formatQuoteNumber(sequence: number, year?: number): string {
  const currentYear = String(year || new Date().getFullYear());
  const formattedSequence = sequence.toString().padStart(4, '0');
  return `QT-${currentYear}-${formattedSequence}`;
}

/**
 * Extracts the sequence from a quote number string.
 */
export function extractSequence(quoteNumber: string | undefined): number {
  if (!quoteNumber) return 0;
  const parts = quoteNumber.split('-');
  if (parts.length < 3) return 0;
  const seqPart = parts[2];
  if (!seqPart) return 0;
  return parseInt(seqPart, 10) || 0;
}
