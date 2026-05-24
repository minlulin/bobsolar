import { create } from "zustand";
import type { InventoryItem, Quotation, QuotationItem } from "@/lib/db/schema";

export interface QuoteBuilderItem {
  id?: string; // UUID from DB if existing
  itemId: string | null; // Inventory Item ID
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercentage: number;
  sortOrder: number;
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

      const newItem: QuoteBuilderItem = {
        itemId: inventoryItem.id,
        description: inventoryItem.name,
        quantity: 1,
        unitPrice: Number(inventoryItem.unitPrice), // Snapshot current price
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
    get().updateItem(index, { unitPrice });
  },

  updateItemDiscount: (index, discountPercentage): void => {
    get().updateItem(index, { discountPercentage });
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
    set({ discountPercent: percent });
  },

  setTax: (percent): void => {
    set({ taxPercent: percent });
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
        })),
    });
  },
}));
