import { beforeEach, describe, expect, it } from "vitest";
import type { InventoryItem } from "@/lib/db/schema";
import { useQuoteBuilderStore } from "@/stores/quote-builder-store";

const inventoryFixture: InventoryItem = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Jinko 550W Panel",
  category: "panel",
  unit: "pcs",
  costPrice: "1000.50",
  unitPrice: "1250.75",
  stockQty: 25,
  brand: "Jinko",
  modelNumber: "JKM550M",
  specifications: null,
  durationMonths: 120,
  isActive: true,
  updatedAt: new Date("2026-05-23T00:00:00.000Z"),
};

describe("quote-builder-store", () => {
  beforeEach(() => {
    useQuoteBuilderStore.getState().reset();
  });

  describe("inventory binding", () => {
    it("binds inventory sell price to quotation item unitPrice snapshot", () => {
      useQuoteBuilderStore.getState().addItem(inventoryFixture);
      const [item] = useQuoteBuilderStore.getState().items;

      expect(item).toBeDefined();
      if (!item) return;

      expect(item.itemId).toBe(inventoryFixture.id);
      expect(item.description).toBe(inventoryFixture.name);
      expect(item.unitPrice).toBe(Number(inventoryFixture.unitPrice));
      expect(item.quantity).toBe(1);
    });

    it("increments quantity for duplicate add and does not overwrite unitPrice", () => {
      useQuoteBuilderStore.getState().addItem(inventoryFixture);
      useQuoteBuilderStore.getState().addItem({
        ...inventoryFixture,
        unitPrice: "9999.99",
      });

      const [item] = useQuoteBuilderStore.getState().items;
      expect(item).toBeDefined();
      if (!item) return;

      expect(item.quantity).toBe(2);
      expect(item.unitPrice).toBe(1250.75);
    });
  });

  describe("addCustomItem and addServiceItem", () => {
    it("adds a custom blank item", () => {
      useQuoteBuilderStore.getState().addCustomItem();
      const items = useQuoteBuilderStore.getState().items;
      expect(items.length).toBe(1);
      expect(items[0]?.description).toBe("Custom Service");
      expect(items[0]?.quantity).toBe(1);
      expect(items[0]?.unitPrice).toBe(0);
      expect(items[0]?.itemId).toBeNull();
    });

    it("adds a service item with specific details", () => {
      useQuoteBuilderStore.getState().addServiceItem("Installation", "Roof mount", 500);
      const items = useQuoteBuilderStore.getState().items;
      expect(items.length).toBe(1);
      expect(items[0]?.description).toBe("Installation — Roof mount");
      expect(items[0]?.unitPrice).toBe(500);
      expect(items[0]?.itemId).toBeNull();
    });
  });

  describe("item updates", () => {
    beforeEach(() => {
      useQuoteBuilderStore.getState().addItem(inventoryFixture);
    });

    it("updates item quantity with positive value", () => {
      useQuoteBuilderStore.getState().updateItemQuantity(0, 5);
      expect(useQuoteBuilderStore.getState().items[0]?.quantity).toBe(5);
    });

    it("sanitizes negative quantity to minimum 0.01", () => {
      useQuoteBuilderStore.getState().updateItemQuantity(0, -5);
      expect(useQuoteBuilderStore.getState().items[0]?.quantity).toBe(0.01);
    });

    it("updates item unit price", () => {
      useQuoteBuilderStore.getState().updateItemPrice(0, 1500);
      expect(useQuoteBuilderStore.getState().items[0]?.unitPrice).toBe(1500);
    });

    it("sanitizes negative unit price to 0", () => {
      useQuoteBuilderStore.getState().updateItemPrice(0, -100);
      expect(useQuoteBuilderStore.getState().items[0]?.unitPrice).toBe(0);
    });

    it("updates item discount percentage", () => {
      useQuoteBuilderStore.getState().updateItemDiscount(0, 10);
      expect(useQuoteBuilderStore.getState().items[0]?.discountPercentage).toBe(10);
    });

    it("sanitizes discount percentage outside 0-100 range", () => {
      useQuoteBuilderStore.getState().updateItemDiscount(0, 150);
      expect(useQuoteBuilderStore.getState().items[0]?.discountPercentage).toBe(100);
      useQuoteBuilderStore.getState().updateItemDiscount(0, -50);
      expect(useQuoteBuilderStore.getState().items[0]?.discountPercentage).toBe(0);
    });

    it("removes an item", () => {
      useQuoteBuilderStore.getState().removeItem(0);
      expect(useQuoteBuilderStore.getState().items.length).toBe(0);
    });
  });

  describe("global updates", () => {
    it("sets discount percent", () => {
      useQuoteBuilderStore.getState().setDiscount(15);
      expect(useQuoteBuilderStore.getState().discountPercent).toBe(15);
    });

    it("sanitizes global discount outside 0-100", () => {
      useQuoteBuilderStore.getState().setDiscount(-10);
      expect(useQuoteBuilderStore.getState().discountPercent).toBe(0);
      useQuoteBuilderStore.getState().setDiscount(101);
      expect(useQuoteBuilderStore.getState().discountPercent).toBe(100);
    });

    it("sets tax percent", () => {
      useQuoteBuilderStore.getState().setTax(8);
      expect(useQuoteBuilderStore.getState().taxPercent).toBe(8);
    });
  });

  describe("loadFromAutosaveDraft", () => {
    it("loads state correctly from draft", () => {
      const draft = {
        savedAt: Date.now(),
        payload: {
          customerId: "cust-1",
          items: [
            {
              itemId: "item-1",
              description: "Test",
              quantity: 2,
              unitPrice: 100,
              discountPercentage: 0,
              category: "panel",
            },
          ],
          discountPercent: 5,
          taxPercent: 10,
          notes: "Autosave notes",
          validUntil: "2026-12-31T00:00:00.000Z",
          quotationDate: "2026-06-20T00:00:00.000Z",
        },
      } as unknown as import("@/lib/validators/quote-autosave").QuoteAutosaveDraft;

      useQuoteBuilderStore.getState().loadFromAutosaveDraft(draft);

      const state = useQuoteBuilderStore.getState();
      expect(state.selectedCustomerId).toBe("cust-1");
      expect(state.discountPercent).toBe(5);
      expect(state.notes).toBe("Autosave notes");
      expect(state.items.length).toBe(1);
      expect(state.items[0]?.category).toBe("panel");
    });
  });
});
