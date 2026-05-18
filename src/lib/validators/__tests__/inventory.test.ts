import { describe, expect, it } from "vitest";
import {
  createInventoryItemSchema,
  updateInventoryItemPayloadSchema,
} from "@/lib/validators/inventory";

const baseItem = {
  name: "Spec Item",
  unit: "pcs" as const,
  unitPrice: 1000,
  stockQty: 5,
  brand: null,
  modelNumber: null,
  isActive: true,
};

describe("inventory specification validation", () => {
  it("accepts valid panel specifications", () => {
    const result = createInventoryItemSchema.safeParse({
      ...baseItem,
      category: "panel",
      specifications: {
        brandModel: "Jinko JKM550",
        cellType: "n_type",
        wattageW: 550,
        warranty: "12 years",
      },
    });

    expect(result.success).toBe(true);
  });

  it("accepts valid inverter specifications", () => {
    const result = createInventoryItemSchema.safeParse({
      ...baseItem,
      category: "inverter",
      specifications: {
        brandModel: "Growatt SPF 5000",
        systemType: "off_grid",
        ratedPower: "5kW",
        phase: "single_phase",
        maxPvInput: "450V",
        warranty: "5 years",
      },
    });

    expect(result.success).toBe(true);
  });

  it("accepts valid battery specifications", () => {
    const result = createInventoryItemSchema.safeParse({
      ...baseItem,
      category: "battery",
      specifications: {
        brandModel: "Pylontech US3000",
        chemistryType: "lifepo4",
        voltageV: 51.2,
        capacityAh: 100,
        warranty: "10 years",
      },
    });

    expect(result.success).toBe(true);
  });

  it("accepts valid mounting specifications", () => {
    const result = createInventoryItemSchema.safeParse({
      ...baseItem,
      category: "mounting",
      specifications: {
        type: "Roof Rail",
      },
    });

    expect(result.success).toBe(true);
  });

  it("accepts valid cable specifications", () => {
    const result = createInventoryItemSchema.safeParse({
      ...baseItem,
      category: "cable",
      specifications: {
        cableType: "dc_cable",
        sizeCrossSection: "6mm2",
        unitOfMeasurement: "meter",
      },
    });

    expect(result.success).toBe(true);
  });

  it("accepts valid accessory specifications", () => {
    const result = createInventoryItemSchema.safeParse({
      ...baseItem,
      category: "accessory",
      specifications: {
        type: "Breaker",
        ratingAmpere: 63,
        voltageRating: "500V",
      },
    });

    expect(result.success).toBe(true);
  });

  it("accepts labor with null specifications", () => {
    const result = createInventoryItemSchema.safeParse({
      ...baseItem,
      category: "labor",
      unit: "job",
      specifications: null,
    });

    expect(result.success).toBe(true);
  });

  it("rejects create when specifications do not match category", () => {
    const result = createInventoryItemSchema.safeParse({
      ...baseItem,
      category: "panel",
      specifications: {
        type: "Breaker",
        ratingAmpere: 63,
        voltageRating: "500V",
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejects update when category changes without specifications", () => {
    const result = updateInventoryItemPayloadSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      category: "battery",
    });

    expect(result.success).toBe(false);
  });

  it("rejects update when specifications are provided without category", () => {
    const result = updateInventoryItemPayloadSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      specifications: {
        brandModel: "Pylontech US3000",
        chemistryType: "lifepo4",
        voltageV: 51.2,
        capacityAh: 100,
        warranty: "10 years",
      },
    });

    expect(result.success).toBe(false);
  });

  it("accepts update when category and compatible specifications are provided together", () => {
    const result = updateInventoryItemPayloadSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      category: "battery",
      specifications: {
        brandModel: "Pylontech US3000",
        chemistryType: "lifepo4",
        voltageV: 51.2,
        capacityAh: 100,
        warranty: "10 years",
      },
    });

    expect(result.success).toBe(true);
  });
});
