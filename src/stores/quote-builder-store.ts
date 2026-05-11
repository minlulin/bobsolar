import { create } from 'zustand';
import {
  type InventoryItem,
  type Quotation,
  type QuotationItem,
} from '@/lib/db/schema';
import { calculateQuotation, type PricingResult } from '@/lib/pricing/engine';

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

  // Actions
  setCustomer: (customerId: string | null) => void;
  addItem: (inventoryItem: InventoryItem) => void;
  removeItem: (index: number) => void;
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
  reset: () => void;
  loadFromQuotation: (
    quotation: Quotation & { items: QuotationItem[] },
  ) => void;

  // Derived (via helper)
  getTotals: () => PricingResult;
}

const initialState = {
  selectedCustomerId: null,
  items: [],
  discountPercent: 0,
  taxPercent: 5, // Default tax 5% as per validators
  notes: '',
  validUntil: null,
};

export const useQuoteBuilderStore = create<QuoteBuilderState>((set, get) => ({
  ...initialState,

  setCustomer: (customerId) => set({ selectedCustomerId: customerId }),

  addItem: (inventoryItem) =>
    set((state) => {
      const existingIndex = state.items.findIndex(
        (item) => item.itemId === inventoryItem.id,
      );

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
    }),

  removeItem: (index) =>
    set((state) => {
      const newItems = state.items.filter((_, i) => i !== index);
      // Re-calculate sort order
      const itemsWithNewOrder = newItems.map((item, i) => ({
        ...item,
        sortOrder: i,
      }));
      return { items: itemsWithNewOrder };
    }),

  updateItemQuantity: (index, quantity) =>
    set((state) => {
      const newItems = [...state.items];
      if (newItems[index]) {
        const sanitizedQuantity = Math.max(1, Math.round(quantity));
        newItems[index] = { ...newItems[index], quantity: sanitizedQuantity };
      }
      return { items: newItems };
    }),

  updateItemPrice: (index, unitPrice) =>
    set((state) => {
      const newItems = [...state.items];
      if (newItems[index]) {
        newItems[index] = { ...newItems[index], unitPrice };
      }
      return { items: newItems };
    }),

  updateItemDiscount: (index, discountPercentage) =>
    set((state) => {
      const newItems = [...state.items];
      if (newItems[index]) {
        newItems[index] = { ...newItems[index], discountPercentage };
      }
      return { items: newItems };
    }),

  updateItemDescription: (index, description) =>
    set((state) => {
      const newItems = [...state.items];
      if (newItems[index]) {
        newItems[index] = { ...newItems[index], description };
      }
      return { items: newItems };
    }),

  setItems: (items) => set({ items }),

  reorderItems: (fromIndex, toIndex) =>
    set((state) => {
      const newItems = [...state.items];
      const [movedItem] = newItems.splice(fromIndex, 1);

      if (!movedItem) return state;

      newItems.splice(toIndex, 0, movedItem);
      return {
        items: newItems.map((item, i) => ({ ...item, sortOrder: i })),
      };
    }),

  setDiscount: (percent) => set({ discountPercent: percent }),

  setTax: (percent) => set({ taxPercent: percent }),

  setNotes: (notes) => set({ notes }),

  setValidUntil: (date) => set({ validUntil: date }),

  reset: () => set(initialState),

  loadFromQuotation: (quotation) =>
    set({
      selectedCustomerId: quotation.customerId,
      discountPercent: Number(quotation.discountPercent),
      taxPercent: Number(quotation.taxPercent),
      notes: quotation.notes || '',
      validUntil: quotation.validUntil ? new Date(quotation.validUntil) : null,
      items: quotation.items
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
    }),

  getTotals: () => {
    const state = get();
    return calculateQuotation(
      state.items,
      state.discountPercent,
      state.taxPercent,
    );
  },
}));
