import { describe, expect, it } from "vitest";
import {
  buildQuoteAutosaveDraft,
  buildQuoteAutosaveKey,
  hashAutosaveSyncInput,
  parseQuoteAutosaveDraft,
  toServerQuotationInputFromDraft,
} from "@/lib/quotations/quote-autosave";

describe("quote autosave", () => {
  it("builds deterministic keys for create and edit", () => {
    expect(buildQuoteAutosaveKey("create")).toBe("quote:draft:new");
    expect(buildQuoteAutosaveKey("edit", "q-123")).toBe("quote:draft:edit:q-123");
  });

  it("serializes and parses autosave draft payload", () => {
    const draft = buildQuoteAutosaveDraft(
      "create",
      {
        customerId: "c7f6b539-bbd5-4f51-ac99-b7ddaa383da3",
        items: [
          {
            itemId: "d24cfca5-c60f-402f-9f48-96fb4a7dbf6b",
            description: "Panel",
            quantity: 2,
            unitPrice: 100_000,
            discountPercentage: 0,
            sortOrder: 0,
          },
        ],
        discountPercent: 0,
        taxPercent: 5,
        notes: "test",
        validUntil: new Date("2026-01-01T00:00:00.000Z"),
        quotationDate: new Date("2026-01-02T00:00:00.000Z"),
      },
      {
        quotationId: "688b51c9-86ba-4ec6-8f66-8a1455dfe82f",
      },
    );

    const parsed = parseQuoteAutosaveDraft(JSON.stringify(draft));
    expect(parsed).not.toBeNull();
    expect(parsed?.payload.items).toHaveLength(1);
    expect(parsed?.payload.validUntilIso).toBe("2026-01-01T00:00:00.000Z");
  });

  it("converts valid draft into server input and hashes consistently", () => {
    const draft = buildQuoteAutosaveDraft("create", {
      customerId: "1f483a72-682f-4aac-94b9-31e2f6ea2d39",
      items: [
        {
          itemId: null,
          description: "Service",
          quantity: 1,
          unitPrice: 50000,
          discountPercentage: 0,
          sortOrder: 0,
        },
      ],
      discountPercent: 10,
      taxPercent: 5,
      notes: "",
      validUntil: null,
      quotationDate: null,
    });
    const input = toServerQuotationInputFromDraft(draft);
    expect(input).not.toBeNull();

    const hash1 = hashAutosaveSyncInput(input);
    const hash2 = hashAutosaveSyncInput(input);
    expect(hash1).toBe(hash2);
  });
});
