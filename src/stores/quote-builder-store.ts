import { create } from "zustand";
import type { InventoryCategory, InventoryItem, Quotation, QuotationItem } from "@/lib/db/schema";
import type { GroupableItem } from "@/lib/utils/quotation-grouping";
import type { QuotationItemInput } from "@/lib/validators/quotation";
import type { QuoteAutosaveDraft } from "@/lib/validators/quote-autosave";

export interface QuoteBuilderItem extends QuotationItemInput, GroupableItem {
  category?: InventoryCategory | null; // Narrow category type
  quantity: number;
  unitPrice: number;
}

interface QuoteBuilderState {
  // Data
  selectedCustomerId: string | null;
  items: QuoteBuilderItem[];
  discountPercent: number;
  taxPercent: number;
  notes: string;
  validUntil: Date | null;
  quotationDate: Date | null;

  // Actions
  setCustomer: (customerId: string | null) => void;
  addItem: (inventoryItem: InventoryItem) => void;
  addCustomItem: () => void;
  addServiceItem: (label: string, description: string, defaultPrice: number) => void;
  removeItem: (index: number) => void;
  updateItem: (index: number, partial: Partial<QuoteBuilderItem>) => void;
  updateItemQuantity: (index: number, quantity: number) => void;
  updateItemPrice: (index: number, unitPrice: number) => void;
  updateItemDiscount: (index: number, discountPercentage: number) => void;
  updateItemDescription: (index: number, description: string) => void;
  setItems: (items: QuoteBuilderItem[]) => void;
  reorderItems: (fromIndex: number, toIndex: number) => void;
  setDiscount: (percent: number) => void;
  setTax: (percent: number) => void;
  setNotes: (notes: string) => void;
  setValidUntil: (date: Date | null) => void;
  setQuotationDate: (date: Date | null) => void;
  reset: () => void;
  loadFromQuotation: (quotation: Quotation & { items: QuotationItem[] }) => void;
  loadFromAutosaveDraft: (draft: QuoteAutosaveDraft) => void;
}

function createInitialState() {
  return {
    selectedCustomerId: null,
    items: [],
    discountPercent: 0,
    taxPercent: 5, // Default tax 5% as per validators
    notes: "",
    validUntil: null,
    quotationDate: new Date(),
  };
}

export const useQuoteBuilderStore = create<QuoteBuilderState>()((set, get) => ({
  ...createInitialState(),

  setCustomer: (customerId): void => {
    set({ selectedCustomerId: customerId });
  },

  addItem: (inventoryItem): void => {
    set((state) => {
      const existingIndex = state.items.findIndex((item) => item.itemId === inventoryItem.id);

      if (existingIndex >= 0) {
        const nextItems = [...state.items];
        const existingItem = nextItems[existingIndex];
        if (existingItem) {
          nextItems[existingIndex] = {
            ...existingItem,
            quantity: existingItem.quantity + 1,
          };
        }
        return { items: nextItems };
      }

      // Build detailed description from specifications
      let description = inventoryItem.name;
      if (inventoryItem.specifications && typeof inventoryItem.specifications === "object") {
        const specs = inventoryItem.specifications as Record<string, unknown>;
        const parts = [];

        // Add brand and model if available
        if (inventoryItem.brand) parts.push(inventoryItem.brand);
        if (inventoryItem.modelNumber) parts.push(inventoryItem.modelNumber);

        // Add technical specs based on category
        switch (inventoryItem.category) {
          case "panel":
            if (specs["wattageW"] && typeof specs["wattageW"] === "number")
              parts.push(`${specs["wattageW"]}W`);
            if (specs["voltageV"] && typeof specs["voltageV"] === "number")
              parts.push(`${specs["voltageV"]}V`);
            break;
          case "inverter":
            if (specs["ratedPower"] && typeof specs["ratedPower"] === "string")
              parts.push(`${specs["ratedPower"]}`);
            if (specs["maxPvInput"] && typeof specs["maxPvInput"] === "string")
              parts.push(`${specs["maxPvInput"]}`);
            break;
          case "battery":
            if (specs["capacityAh"] && typeof specs["capacityAh"] === "number")
              parts.push(`${specs["capacityAh"]}Ah`);
            if (specs["voltageV"] && typeof specs["voltageV"] === "number")
              parts.push(`${specs["voltageV"]}V`);
            break;
          case "mounting":
            if (specs["type"] && typeof specs["type"] === "string") parts.push(`${specs["type"]}`);
            break;
          case "cable":
            if (specs["sizeCrossSection"] && typeof specs["sizeCrossSection"] === "string")
              parts.push(`${specs["sizeCrossSection"]}`);
            if (specs["unitOfMeasurement"] && typeof specs["unitOfMeasurement"] === "string")
              parts.push(`${specs["unitOfMeasurement"]}`);
            break;
          case "accessory":
            if (specs["type"] && typeof specs["type"] === "string") parts.push(`${specs["type"]}`);
            if (specs["ratingAmpere"] && typeof specs["ratingAmpere"] === "number")
              parts.push(`${specs["ratingAmpere"]}A`);
            if (specs["voltageRating"] && typeof specs["voltageRating"] === "string")
              parts.push(`${specs["voltageRating"]}V`);
            break;
          default:
            // For other categories, add all specification values
            Object.values(specs).forEach((value) => {
              if (value && typeof value === "string" && value.toString().trim() !== "") {
                parts.push(value.toString());
              }
            });
        }

        if (parts.length > 0) {
          description = [...parts].join(" ");
        }
      }

      const newItem: QuoteBuilderItem = {
        itemId: inventoryItem.id,
        description: description,
        quantity: 1,
        unitPrice: Number(inventoryItem.unitPrice), // Snapshot current price
        discountPercentage: 0,
        sortOrder: state.items.length,
        category: inventoryItem.category,
      };
      return { items: [...state.items, newItem] };
    });
  },

  addCustomItem: (): void => {
    set((state) => {
      const newItem: QuoteBuilderItem = {
        itemId: null,
        description: "Custom Service",
        quantity: 1,
        unitPrice: 0,
        discountPercentage: 0,
        sortOrder: state.items.length,
      };
      return { items: [...state.items, newItem] };
    });
  },

  addServiceItem: (label: string, description: string, defaultPrice: number): void => {
    set((state) => {
      const newItem: QuoteBuilderItem = {
        itemId: null,
        description: `${label} — ${description}`,
        quantity: 1,
        unitPrice: defaultPrice,
        discountPercentage: 0,
        sortOrder: state.items.length,
      };
      return { items: [...state.items, newItem] };
    });
  },

  removeItem: (index): void => {
    set((state) => {
      const newItems = state.items.filter((_, i) => i !== index);
      // Re-calculate sort order
      const itemsWithNewOrder = newItems.map((item, i) => ({
        ...item,
        sortOrder: i,
      }));
      return { items: itemsWithNewOrder };
    });
  },

  updateItem: (index: number, partial: Partial<QuoteBuilderItem>): void => {
    set((state) => {
      const newItems = [...state.items];
      if (newItems[index]) {
        const existing = newItems[index];
        newItems[index] = { ...existing, ...partial };
        // If quantity is being updated, sanitize it
        if (partial.quantity !== undefined) {
          newItems[index] = {
            ...newItems[index],
            quantity: Math.max(0.01, Math.round(partial.quantity * 100) / 100),
          };
        }
      }
      return { items: newItems };
    });
  },

  updateItemQuantity: (index, quantity): void => {
    const sanitizedQuantity = Math.max(0.01, Math.round(quantity * 100) / 100);
    get().updateItem(index, { quantity: sanitizedQuantity });
  },

  updateItemPrice: (index, unitPrice): void => {
    const sanitized = Math.max(0, unitPrice);
    get().updateItem(index, { unitPrice: sanitized });
  },

  updateItemDiscount: (index, discountPercentage): void => {
    const sanitized = Math.max(0, Math.min(100, discountPercentage));
    get().updateItem(index, { discountPercentage: sanitized });
  },

  updateItemDescription: (index, description): void => {
    get().updateItem(index, { description });
  },

  setItems: (items): void => {
    set({ items });
  },

  reorderItems: (fromIndex, toIndex): void => {
    set((state) => {
      const newItems = [...state.items];
      const [movedItem] = newItems.splice(fromIndex, 1);

      if (!movedItem) return state;

      newItems.splice(toIndex, 0, movedItem);
      return {
        items: newItems.map((item, i) => ({ ...item, sortOrder: i })),
      };
    });
  },

  setDiscount: (percent): void => {
    const sanitized = Math.max(0, Math.min(100, percent));
    set({ discountPercent: sanitized });
  },

  setTax: (percent): void => {
    const sanitized = Math.max(0, Math.min(100, percent));
    set({ taxPercent: sanitized });
  },

  setNotes: (notes): void => {
    set({ notes });
  },

  setValidUntil: (date): void => {
    set({ validUntil: date });
  },

  setQuotationDate: (date): void => {
    set({ quotationDate: date });
  },

  reset: (): void => {
    set(createInitialState());
  },

  loadFromQuotation: (quotation): void => {
    set({
      selectedCustomerId: quotation.customerId,
      discountPercent: Number(quotation.discountPercent),
      taxPercent: Number(quotation.taxPercent),
      notes: quotation.notes || "",
      validUntil: quotation.validUntil ? new Date(quotation.validUntil) : null,
      quotationDate: quotation.createdAt ? new Date(quotation.createdAt) : null,
      items: [...quotation.items]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item) => ({
          id: item.id,
          itemId: item.itemId,
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          discountPercentage: Number(item.discountPercentage || 0),
          sortOrder: item.sortOrder,
          category:
            (item as QuotationItem & { inventoryItem?: InventoryItem | null }).inventoryItem
              ?.category || null,
        })),
    });
  },

  loadFromAutosaveDraft: (draft): void => {
    set({
      selectedCustomerId: draft.payload.customerId,
      discountPercent: draft.payload.discountPercent,
      taxPercent: draft.payload.taxPercent,
      notes: draft.payload.notes,
      validUntil: draft.payload.validUntilIso ? new Date(draft.payload.validUntilIso) : null,
      quotationDate: draft.payload.quotationDateIso
        ? new Date(draft.payload.quotationDateIso)
        : null,
      items: draft.payload.items.map((item) => ({
        ...(item.id ? { id: item.id } : {}),
        itemId: item.itemId ?? null,
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discountPercentage: Number(item.discountPercentage || 0),
        sortOrder: item.sortOrder,
        category: (item.category as InventoryCategory) ?? null,
      })),
    });
  },
}));
