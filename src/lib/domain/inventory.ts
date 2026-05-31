import { z } from "zod";
import { type InventoryCategory, inventoryCategoryEnum, inventoryUnitEnum } from "@/lib/db/schema";

export const INVENTORY_CATEGORIES = inventoryCategoryEnum.enumValues;
export const inventoryCategorySchema = z.enum(INVENTORY_CATEGORIES);

export const INVENTORY_UNITS = inventoryUnitEnum.enumValues;
export const inventoryUnitSchema = z.enum(INVENTORY_UNITS);

export const PANEL_CELL_TYPES = ["n_type", "p_type"] as const;
export const INVERTER_SYSTEM_TYPES = ["hybrid", "off_grid", "on_grid"] as const;
export const INVERTER_PHASES = ["single_phase", "three_phase"] as const;
export const BATTERY_CHEMISTRY_TYPES = ["lifepo4", "gel", "lead_acid"] as const;
export const CABLE_TYPES = ["dc_cable", "ac_cable", "earth_wire"] as const;

export const DEFAULT_SPECIFICATIONS_BY_CATEGORY: Record<string, unknown> = {
  panel: { brandModel: "", cellType: "n_type", wattageW: 0, warranty: "" },
  inverter: {
    brandModel: "",
    systemType: "hybrid",
    ratedPower: "",
    phase: "single_phase",
    maxPvInput: "",
    warranty: "",
  },
  battery: {
    brandModel: "",
    chemistryType: "lifepo4",
    voltageV: 0,
    capacityAh: 0,
    warranty: "",
  },
  mounting: { type: "" },
  cable: { cableType: "dc_cable", sizeCrossSection: "", unitOfMeasurement: "" },
  accessory: { type: "" },
  protection: { type: "" },
  labor: { note: "" },
  service: { note: "" },
};

export const PANEL_CELL_TYPE_LABELS: Record<string, string> = {
  n_type: "N-Type",
  p_type: "P-Type",
};

export const INVERTER_SYSTEM_TYPE_LABELS: Record<string, string> = {
  hybrid: "Hybrid",
  off_grid: "Off Grid",
  on_grid: "On Grid",
};

export const INVERTER_PHASE_LABELS: Record<string, string> = {
  single_phase: "Single Phase",
  three_phase: "Three Phase",
};

export const BATTERY_CHEMISTRY_TYPE_LABELS: Record<string, string> = {
  lifepo4: "LiFePO4",
  gel: "GEL",
  lead_acid: "Lead Acid",
};

export const CABLE_TYPE_LABELS: Record<string, string> = {
  dc_cable: "DC Cable",
  ac_cable: "AC Cable",
  earth_wire: "Earth Wire",
};

export const INVENTORY_CATEGORY_LABELS: Record<InventoryCategory, string> = {
  panel: "Panel",
  inverter: "Inverter",
  battery: "Battery",
  mounting: "Mounting",
  cable: "Cable",
  accessory: "Accessory",
  protection: "Protection",
  labor: "Labor",
  service: "Service",
};

export type BrandModelResult = {
  brand: string;
  modelNumber: string;
};

type InventoryDisplayInput = {
  category: InventoryCategory;
  specifications: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringifySpec(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function numberSpec(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatSpecNumber(value: number): string {
  return String(value);
}

function labelFromMap(labels: Record<string, string>, value: string): string {
  return labels[value] ?? value.replace(/_/g, " ");
}

export function getInventoryCategoryLabel(category: InventoryCategory | string): string {
  return INVENTORY_CATEGORY_LABELS[category as InventoryCategory] ?? category.replace(/_/g, " ");
}

export function formatInventorySpecSummary({
  category,
  specifications,
}: InventoryDisplayInput): string | null {
  if (!isRecord(specifications)) return null;

  switch (category) {
    case "panel": {
      const wattage = numberSpec(specifications["wattageW"]);
      const cellType = stringifySpec(specifications["cellType"]);
      const parts = [
        wattage !== null ? `${formatSpecNumber(wattage)}W` : null,
        cellType ? labelFromMap(PANEL_CELL_TYPE_LABELS, cellType) : null,
      ];
      return parts.filter((part): part is string => part !== null).join(" / ") || null;
    }
    case "inverter": {
      const ratedPower = stringifySpec(specifications["ratedPower"]);
      const systemType = stringifySpec(specifications["systemType"]);
      const phase = stringifySpec(specifications["phase"]);
      const parts = [
        ratedPower,
        systemType ? labelFromMap(INVERTER_SYSTEM_TYPE_LABELS, systemType) : null,
        phase ? labelFromMap(INVERTER_PHASE_LABELS, phase) : null,
      ];
      return parts.filter((part): part is string => part !== null).join(" / ") || null;
    }
    case "battery": {
      const voltageV = numberSpec(specifications["voltageV"]);
      const capacityAh = numberSpec(specifications["capacityAh"]);
      const chemistryType = stringifySpec(specifications["chemistryType"]);
      const parts = [
        voltageV !== null ? `${formatSpecNumber(voltageV)}V` : null,
        capacityAh !== null ? `${formatSpecNumber(capacityAh)}Ah` : null,
        chemistryType ? labelFromMap(BATTERY_CHEMISTRY_TYPE_LABELS, chemistryType) : null,
      ];
      return parts.filter((part): part is string => part !== null).join(" / ") || null;
    }
    case "mounting":
      return stringifySpec(specifications["type"]);
    case "cable": {
      const cableType = stringifySpec(specifications["cableType"]);
      const sizeCrossSection = stringifySpec(specifications["sizeCrossSection"]);
      const unitOfMeasurement = stringifySpec(specifications["unitOfMeasurement"]);
      const parts = [
        cableType ? labelFromMap(CABLE_TYPE_LABELS, cableType) : null,
        sizeCrossSection,
        unitOfMeasurement,
      ];
      return parts.filter((part): part is string => part !== null).join(" / ") || null;
    }
    case "accessory": {
      const type = stringifySpec(specifications["type"]);
      const ratingAmpere = numberSpec(specifications["ratingAmpere"]);
      const voltageRating = stringifySpec(specifications["voltageRating"]);
      const parts = [
        type,
        ratingAmpere !== null ? `${formatSpecNumber(ratingAmpere)}A` : null,
        voltageRating,
      ];
      return parts.filter((part): part is string => part !== null).join(" / ") || null;
    }
    case "protection": {
      const type = stringifySpec(specifications["type"]);
      const ratingAmpere = numberSpec(specifications["ratingAmpere"]);
      const voltageRating = stringifySpec(specifications["voltageRating"]);
      const parts = [
        type,
        ratingAmpere !== null ? `${formatSpecNumber(ratingAmpere)}A` : null,
        voltageRating,
      ];
      return parts.filter((part): part is string => part !== null).join(" / ") || null;
    }
    case "labor":
    case "service":
      return stringifySpec(specifications["note"]);
  }
}

export function formatInventoryCatalogDescriptor(item: InventoryDisplayInput): string {
  const categoryLabel = getInventoryCategoryLabel(item.category);
  const specSummary = formatInventorySpecSummary(item);
  return specSummary ? `${categoryLabel} - ${specSummary}` : categoryLabel;
}

/**
 * Extract brand and modelNumber from a `specifications.brandModel` string.
 * The convention is: first token = brand, rest = modelNumber.
 * Only applies to panel, inverter, and battery categories.
 */
export function extractBrandModel(
  category: string,
  specifications: unknown,
  fallbackBrand?: string | null,
  fallbackModel?: string | null,
): BrandModelResult {
  let brand = fallbackBrand ?? null;
  let modelNumber = fallbackModel ?? null;

  if (
    ["panel", "inverter", "battery"].includes(category) &&
    specifications &&
    typeof specifications === "object"
  ) {
    const specs = specifications as Record<string, unknown>;
    if (typeof specs["brandModel"] === "string") {
      const brandModel = specs["brandModel"].trim();
      const parts = brandModel.split(/\s+/);
      brand = parts[0] || "";
      modelNumber = parts.slice(1).join(" ") || "";
    }
  }

  return { brand: brand ?? "", modelNumber: modelNumber ?? "" };
}
