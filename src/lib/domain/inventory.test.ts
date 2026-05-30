import { describe, expect, it } from "vitest";
import {
  formatInventoryCatalogDescriptor,
  formatInventorySpecSummary,
  getInventoryCategoryLabel,
} from "@/lib/domain/inventory";

describe("inventory domain display helpers", () => {
  it("formats the category label from the canonical inventory category", () => {
    expect(getInventoryCategoryLabel("battery")).toBe("Battery");
    expect(getInventoryCategoryLabel("inverter")).toBe("Inverter");
  });

  it("shows battery voltage and capacity in catalog descriptors", () => {
    const item = {
      category: "battery" as const,
      specifications: {
        brandModel: "Felicity",
        chemistryType: "lifepo4",
        voltageV: 51,
        capacityAh: 300,
        warranty: "5 years",
      },
    };

    expect(formatInventorySpecSummary(item)).toBe("51V / 300Ah / LiFePO4");
    expect(formatInventoryCatalogDescriptor(item)).toBe("Battery - 51V / 300Ah / LiFePO4");
  });

  it("keeps same-name inverter and battery items distinguishable", () => {
    const inverter = formatInventoryCatalogDescriptor({
      category: "inverter",
      specifications: {
        brandModel: "Felicity",
        systemType: "hybrid",
        ratedPower: "5kW",
        phase: "single_phase",
        maxPvInput: "500V",
        warranty: "2 years",
      },
    });

    const battery = formatInventoryCatalogDescriptor({
      category: "battery",
      specifications: {
        brandModel: "Felicity",
        chemistryType: "lifepo4",
        voltageV: 51,
        capacityAh: 300,
        warranty: "5 years",
      },
    });

    expect(inverter).toBe("Inverter - 5kW / Hybrid / Single Phase");
    expect(battery).toBe("Battery - 51V / 300Ah / LiFePO4");
  });
});
