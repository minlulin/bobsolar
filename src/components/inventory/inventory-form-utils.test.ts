import { describe, expect, it } from "vitest";
import {
  deriveInventoryName,
  extractSpecErrorMessage,
  formatNumericInputValue,
  parseNumericInput,
} from "@/components/inventory/inventory-form-utils";

describe("inventory form utils", () => {
  it("formats zero numeric values as empty input text for clean typing UX", () => {
    expect(formatNumericInputValue(0)).toBe("");
    expect(formatNumericInputValue(12)).toBe("12");
  });

  it("parses numeric input safely without forcing empty string to 0", () => {
    expect(parseNumericInput("")).toBeUndefined();
    expect(parseNumericInput("1")).toBe(1);
  });

  it("derives inventory name from category-specific specification fields", () => {
    expect(deriveInventoryName("panel", { brandModel: "Jinko 550W" }, "")).toBe("Jinko 550W");
    expect(deriveInventoryName("mounting", { type: "Rail Set" }, "")).toBe("Rail Set");
  });

  it("extracts first nested specification validation message", () => {
    expect(
      extractSpecErrorMessage({
        brandModel: { message: "Panel brand/model is required" },
      }),
    ).toBe("Panel brand/model is required");
  });
});
