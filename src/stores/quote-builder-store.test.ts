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

describe("quote-builder-store inventory binding", () => {
  beforeEach(() => {
    useQuoteBuilderStore.getState().reset();
  });

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
