import {
  QUOTE_AUTOSAVE_SCHEMA_VERSION,
  type QuoteAutosaveDraft,
  quoteAutosaveDraftSchema,
} from "@/lib/validators/quote-autosave";
import type { QuoteBuilderItem } from "@/stores/quote-builder-store";

export interface QuoteAutosaveStateSnapshot {
  customerId: string | null;
  items: QuoteBuilderItem[];
  discountPercent: number;
  taxPercent: number;
  notes: string;
  validUntil: Date | null;
  quotationDate: Date | null;
}

export type QuoteAutosaveMode = "create" | "edit";

export function buildQuoteAutosaveKey(mode: QuoteAutosaveMode, quotationId?: string): string {
  if (mode === "edit") return `quote:draft:edit:${quotationId ?? "unknown"}`;
  return "quote:draft:new";
}

export function buildQuoteAutosaveDraft(
  mode: QuoteAutosaveMode,
  snapshot: QuoteAutosaveStateSnapshot,
  options?: {
    quotationId?: string | null;
    serverUpdatedAt?: Date | null;
    dirty?: boolean;
    savedAt?: number;
  },
): QuoteAutosaveDraft {
  return {
    version: QUOTE_AUTOSAVE_SCHEMA_VERSION,
    mode,
    quotationId: options?.quotationId ?? null,
    serverUpdatedAtIso: options?.serverUpdatedAt ? options.serverUpdatedAt.toISOString() : null,
    savedAt: options?.savedAt ?? Date.now(),
    dirty: options?.dirty ?? true,
    payload: {
      customerId: snapshot.customerId,
      items: snapshot.items.map((item) => ({
        id: item.id,
        itemId: item.itemId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountPercentage: item.discountPercentage,
        sortOrder: item.sortOrder,
        category: item.category ?? null,
      })),
      discountPercent: snapshot.discountPercent,
      taxPercent: snapshot.taxPercent,
      notes: snapshot.notes,
      validUntilIso: snapshot.validUntil ? snapshot.validUntil.toISOString() : null,
      quotationDateIso: snapshot.quotationDate ? snapshot.quotationDate.toISOString() : null,
    },
  };
}

export function parseQuoteAutosaveDraft(raw: string): QuoteAutosaveDraft | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    const result = quoteAutosaveDraftSchema.safeParse(parsed);
    if (!result.success) return null;
    return result.data;
  } catch {
    return null;
  }
}

export function readQuoteAutosaveDraft(key: string): QuoteAutosaveDraft | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  return parseQuoteAutosaveDraft(raw);
}

export function writeQuoteAutosaveDraft(key: string, draft: QuoteAutosaveDraft): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(draft));
}

export function clearQuoteAutosaveDraft(key: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
}

export function toServerQuotationInputFromDraft(draft: QuoteAutosaveDraft): {
  customerId: string;
  items: Array<{
    itemId: string | null;
    description: string;
    quantity: number;
    unitPrice: number;
    discountPercentage: number;
    sortOrder: number;
  }>;
  discountPercent: number;
  taxPercent: number;
  notes: string;
  validUntil: Date | null;
  quotationDate: Date | null;
} | null {
  if (!draft.payload.customerId || draft.payload.items.length === 0) return null;

  return {
    customerId: draft.payload.customerId,
    items: draft.payload.items.map((item) => ({
      itemId: item.itemId ?? null,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountPercentage: item.discountPercentage,
      sortOrder: item.sortOrder,
    })),
    discountPercent: draft.payload.discountPercent,
    taxPercent: draft.payload.taxPercent,
    notes: draft.payload.notes,
    validUntil: draft.payload.validUntilIso ? new Date(draft.payload.validUntilIso) : null,
    quotationDate: draft.payload.quotationDateIso ? new Date(draft.payload.quotationDateIso) : null,
  };
}

export function isQuoteAutosaveEffectivelyEmpty(draft: QuoteAutosaveDraft): boolean {
  return (
    !draft.payload.customerId &&
    draft.payload.items.length === 0 &&
    draft.payload.notes.trim() === ""
  );
}

export function hashAutosaveSyncInput(input: unknown): string {
  return JSON.stringify(input);
}
