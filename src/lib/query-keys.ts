import {
  quotationFilterSchema,
  type QuotationFilterInput,
} from '@/lib/validators/quotation';
import {
  inventoryFilterSchema,
  type InventoryFilter,
} from '@/lib/validators/inventory';

function normalizeOptionalString(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeQuotationFilters(
  filters: QuotationFilterInput = {},
): Required<QuotationFilterInput> {
  const parsed = quotationFilterSchema.parse(filters);
  return {
    status: parsed.status ?? null,
    customerId: parsed.customerId ?? null,
    search: normalizeOptionalString(parsed.search),
    archived: parsed.archived ?? null,
    page: parsed.page,
    limit: parsed.limit,
  };
}

export function normalizeInventoryFilters(
  filters: InventoryFilter = {},
): Required<InventoryFilter> {
  const parsed = inventoryFilterSchema.parse(filters);
  return {
    category: parsed.category ?? null,
    search: normalizeOptionalString(parsed.search),
    isActive: parsed.isActive ?? null,
    page: parsed.page,
    limit: parsed.limit,
  };
}

export const quotationKeys = {
  all: ['quotations'] as const,
  list: (filters: QuotationFilterInput = {}) =>
    [...quotationKeys.all, 'list', normalizeQuotationFilters(filters)] as const,
  detail: (id: string) => [...quotationKeys.all, 'detail', id] as const,
};

export const inventoryKeys = {
  all: ['inventory'] as const,
  list: (filters: InventoryFilter = {}) =>
    [...inventoryKeys.all, 'list', normalizeInventoryFilters(filters)] as const,
  detail: (id: string) => [...inventoryKeys.all, 'detail', id] as const,
  search: (search: string) => [...inventoryKeys.all, 'search', search] as const,
};

export const projectKeys = {
  all: ['projects'] as const,
  list: (filters: Record<string, unknown>) =>
    [...projectKeys.all, 'list', filters] as const,
  detail: (id: string) => [...projectKeys.all, 'detail', id] as const,
};

export const dashboardKeys = {
  all: ['dashboard'] as const,
};

export const warrantyKeys = {
  all: ['warranty'] as const,
};
