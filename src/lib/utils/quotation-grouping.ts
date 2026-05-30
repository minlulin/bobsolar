export interface GroupableItem {
  description: string;
  quantity: number | string;
  unitPrice: number | string;
  totalPrice?: number | string;
  category?: string | null;
  [key: string]: unknown;
}

export interface GroupedQuotationDisplayItem extends GroupableItem {
  id: string;
  itemId: null;
}

/**
 * Groups minor quotation items (accessories, cables, mounting, protection)
 * into a single aggregated line item for presentation purposes.
 * Major items (panels, inverters, batteries, labor) and uncategorized items
 * are left intact.
 */
export function groupQuotationItems<T extends GroupableItem>(
  items: T[],
): Array<T | GroupedQuotationDisplayItem> {
  const majorCategories = ["panel", "inverter", "battery", "labor", "service"];

  const majorItems: T[] = [];
  const minorItems: T[] = [];

  for (const item of items) {
    if (!item.category || majorCategories.includes(item.category)) {
      majorItems.push(item);
    } else {
      minorItems.push(item);
    }
  }

  if (minorItems.length === 0) {
    return majorItems;
  }

  let aggregatedTotal = 0;

  for (const minor of minorItems) {
    const qty = Number(minor.quantity) || 0;
    const price = Number(minor.unitPrice) || 0;
    const total = minor.totalPrice !== undefined ? Number(minor.totalPrice) : qty * price;
    aggregatedTotal += total;
  }

  // Create the aggregated item
  // We use type assertion to satisfy the generic constraint T
  const aggregatedItem: GroupedQuotationDisplayItem = {
    ...minorItems[0], // Keep other properties from the first minor item to satisfy T
    id: "aggregated-minor-items",
    itemId: null,
    description: "System Accessories, Mounting & Protection",
    quantity: 1, // Quantity 1 for the grouped lot
    unitPrice: aggregatedTotal, // Unit price is the total of all minor items
    totalPrice: aggregatedTotal,
    category: "accessory", // Group it as an accessory
  };

  return [...majorItems, aggregatedItem];
}
