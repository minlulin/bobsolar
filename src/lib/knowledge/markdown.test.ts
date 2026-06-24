import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseKnowledgeMarkdown } from "./markdown";

describe("parseKnowledgeMarkdown", () => {
  it("parses Felicity manuals by model, capacity, code, and category", () => {
    const content = readFileSync(
      resolve(
        process.cwd(),
        "src",
        "lib",
        "knowledge",
        "data",
        "Fault_Codes_and_Troubleshooting_3KVA_5KVA.md",
      ),
      "utf-8",
    );
    const chunks = parseKnowledgeMarkdown(content, {
      brand: "Felicity",
      model: "IVEM3048-LV, IVEM5048-LV",
      capacity: "3KVA, 5KVA",
    });

    expect(chunks.length).toBeGreaterThan(50);
    expect(chunks).toContainEqual(
      expect.objectContaining({
        brand: "Felicity",
        model: "IVEM3048-LV, IVEM5048-LV",
        capacity: "3KVA, 5KVA",
        errorCode: "33",
        category: "Bus Voltage Faults",
      }),
    );
  });

  it("keeps Growatt fault code families model-specific", () => {
    const cases = [
      {
        file: "Growatt_SPF_3500_5000_ES_Fault_Codes.md",
        model: "SPF 3500 ES, SPF 5000 ES",
        capacity: "3.5KVA, 5KVA",
        code: "80",
      },
      {
        file: "Growatt_SPF_3000T_HVM_G2_Fault_Codes.md",
        model: "SPF 3000T HVM-G2",
        capacity: "3KVA",
        code: "63",
      },
      {
        file: "Growatt_SPF_4000_12000T_DVM_US_Fault_Codes.md",
        model: "SPF 4000T-12000T DVM-US MPV",
        capacity: "4KVA, 5KVA, 6KVA, 8KVA, 10KVA, 12KVA",
        code: "54",
      },
    ];

    for (const testCase of cases) {
      const chunks = parseKnowledgeMarkdown(
        readFileSync(
          resolve(process.cwd(), "src", "lib", "knowledge", "data", testCase.file),
          "utf-8",
        ),
        { brand: "Growatt", model: testCase.model, capacity: testCase.capacity },
      );

      expect(chunks).toContainEqual(
        expect.objectContaining({
          brand: "Growatt",
          model: testCase.model,
          capacity: testCase.capacity,
          errorCode: testCase.code,
        }),
      );
    }
  });
});
