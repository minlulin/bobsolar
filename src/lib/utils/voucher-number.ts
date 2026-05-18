const VOUCHER_NUMBER_RE = /^VC-\d{4}-(\d{4})$/;

export function formatVoucherNumber(sequence: number, year?: number): string {
  const y = String(year ?? new Date().getFullYear());
  return `VC-${y}-${sequence.toString().padStart(4, "0")}`;
}

export function extractVoucherSequence(voucherNumber: string | undefined): number {
  if (!voucherNumber) return 0;
  const match = voucherNumber.match(VOUCHER_NUMBER_RE);
  if (!match) return 0;
  return parseInt(match[1] ?? "0", 10);
}
