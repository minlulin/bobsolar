import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Helper: create mock quotation with plain objects ──────────────────
// (Avoids importing from @/lib/db/schema which triggers drizzle-orm side effects)

interface MockCustomer {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  address: string | null;
  city: string | null;
  notes: string | null;
  isArchived: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MockItem {
  id: string;
  quotationId: string;
  itemId: string | null;
  description: string;
  quantity: string;
  discountPercentage: string;
  unitPrice: string;
  totalPrice: string;
  sortOrder: number;
}

interface MockQuotation {
  id: string;
  quoteNumber: string;
  customerId: string;
  createdBy: string;
  status: string;
  subtotal: string;
  discountPercent: string;
  discountAmount: string;
  taxPercent: string;
  taxAmount: string;
  total: string;
  notes: string | null;
  validUntil: Date | null;
  isArchived: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  items: MockItem[];
  customer: MockCustomer;
}

function mockCustomer(overrides: Partial<MockCustomer> = {}): MockCustomer {
  return {
    id: "c-1",
    name: "Test Customer",
    email: "customer@example.com",
    phone: "09-123456789",
    address: "123 Test St",
    city: "Yangon",
    notes: null,
    isArchived: false,
    archivedAt: null,
    createdAt: new Date("2026-05-01"),
    updatedAt: new Date("2026-05-01"),
    ...overrides,
  };
}

function mockItem(overrides: Partial<MockItem> = {}): MockItem {
  return {
    id: "item-1",
    quotationId: "q-1",
    itemId: null,
    description: "Solar Panel 400W",
    quantity: "10",
    discountPercentage: "0",
    unitPrice: "350000",
    totalPrice: "3500000",
    sortOrder: 0,
    ...overrides,
  };
}

function mockQuotation(
  overrides: Partial<MockQuotation> & {
    items?: MockItem[];
    customer?: MockCustomer;
  } = {},
): MockQuotation {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    quoteNumber: "QT-2026-0001",
    customerId: "c-1",
    createdBy: "user-1",
    status: "sent",
    subtotal: "6150000",
    discountPercent: "5",
    discountAmount: "307500",
    taxPercent: "10",
    taxAmount: "584250",
    total: "6426750",
    notes: "Test notes",
    validUntil: new Date("2026-06-01"),
    isArchived: false,
    archivedAt: null,
    createdAt: new Date("2026-05-01"),
    updatedAt: new Date("2026-05-01"),
    items: [mockItem()],
    customer: mockCustomer(),
    ...overrides,
  };
}

// ─── Test Suite 1: QuoteHtml produces valid HTML with correct content ────

describe("Quotation HTML Print Template", () => {
  it("renders full HTML document with doctype and lang attribute", async () => {
    const { QuoteHtml } = await import("@/components/pdf/quote-html");
    const html = QuoteHtml({
      quotation: mockQuotation(),
      companyLogoUrl: null,
      companySettings: {
        company_name: "BOB Solar",
        company_address: "123 Solar St",
      },
    });

    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toMatch(/<html lang="en">/);
    expect(html).toMatch(/QT-2026-0001/);
    expect(html).toMatch(/BOB Solar/);
    expect(html).toMatch(/Test Customer/);
    expect(html).toMatch(/Solar Panel 400W/);
    expect(html).toMatch(/6,426,750/); // grand total formatted
  });

  it("includes A4 print styles with @page rule", async () => {
    const { QuoteHtml } = await import("@/components/pdf/quote-html");
    const html = QuoteHtml({
      quotation: mockQuotation({
        items: [],
        discountPercent: "0",
        discountAmount: "0",
        taxPercent: "0",
        taxAmount: "0",
        notes: null,
      }),
    });

    expect(html).toMatch(/@page\s*\{/);
    expect(html).toMatch(/size:\s*A4/);
    expect(html).toMatch(/@media print/);
  });

  it("includes Burmese-supporting font fallback stack", async () => {
    const { QuoteHtml } = await import("@/components/pdf/quote-html");
    const html = QuoteHtml({
      quotation: mockQuotation({
        items: [],
        discountPercent: "0",
        discountAmount: "0",
        taxPercent: "0",
        taxAmount: "0",
        notes: null,
      }),
    });

    // Should contain Inter system font stack and Burmese-capable fallbacks
    expect(html).toMatch(/Inter/);
    expect(html).toMatch(/-apple-system/);
  });

  it("supports voucher type with correct title", async () => {
    const { QuoteHtml } = await import("@/components/pdf/quote-html");
    const html = QuoteHtml({
      quotation: mockQuotation({
        quoteNumber: "VC-2026-0001",
        items: [],
        discountPercent: "0",
        discountAmount: "0",
        taxPercent: "0",
        taxAmount: "0",
        notes: null,
      }),
      type: "voucher",
    });

    expect(html).toMatch(/VOUCHER/);
    expect(html).toMatch(/Valid Until/);
  });

  it("includes Save as PDF button with window.print()", async () => {
    const { QuoteHtml } = await import("@/components/pdf/quote-html");
    const html = QuoteHtml({
      quotation: mockQuotation({
        items: [],
        discountPercent: "0",
        discountAmount: "0",
        taxPercent: "0",
        taxAmount: "0",
        notes: null,
      }),
    });

    expect(html).toMatch(/window\.print\(\)/);
    expect(html).toMatch(/PRINT DOCUMENT/);
    expect(html).toMatch(/btn-primary/);
    expect(html).toMatch(/screen-toolbar/);
    expect(html).toMatch(/print-area/);
  });

  it("handles discount and tax display correctly", async () => {
    const { QuoteHtml } = await import("@/components/pdf/quote-html");
    const html = QuoteHtml({
      quotation: mockQuotation({
        discountPercent: "10",
        discountAmount: "615000",
        taxPercent: "5",
        taxAmount: "276750",
      }),
    });

    expect(html).toMatch(/Incentive Applied \(10%\)/);
    expect(html).toMatch(/Commercial Tax \(5%\)/);
    expect(html).toMatch(/615,000/); // formatted discount amount
    expect(html).toMatch(/276,750/); // formatted tax amount
  });

  it("omits discount section when discount is zero", async () => {
    const { QuoteHtml } = await import("@/components/pdf/quote-html");
    const html = QuoteHtml({
      quotation: mockQuotation({
        discountPercent: "0",
        discountAmount: "0",
        items: [],
        taxPercent: "0",
        taxAmount: "0",
        notes: null,
      }),
    });

    expect(html).not.toMatch(/Discount/);
  });

  it("renders company logo when URL is provided", async () => {
    const { QuoteHtml } = await import("@/components/pdf/quote-html");
    const html = QuoteHtml({
      quotation: mockQuotation({
        items: [],
        discountPercent: "0",
        discountAmount: "0",
        taxPercent: "0",
        taxAmount: "0",
        notes: null,
      }),
      companyLogoUrl: "https://example.com/logo.png",
    });

    expect(html).toMatch(/logo-placeholder/);
  });
});

// ─── Test Suite 2: Route handler serves HTML, handles errors gracefully ──

vi.mock("@/lib/auth/validate", () => ({
  getCurrentUser: vi.fn(() => Promise.resolve({ id: "user-1", role: "admin" })),
}));

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      quotations: {
        findFirst: vi.fn(() =>
          Promise.resolve({
            id: "00000000-0000-4000-8000-000000000001",
            quoteNumber: "QT-2026-0001",
            customerId: "c-1",
            createdBy: "user-1",
            status: "sent",
            subtotal: "6150000",
            discountPercent: "5",
            discountAmount: "307500",
            taxPercent: "10",
            taxAmount: "584250",
            total: "6426750",
            notes: "Test notes",
            validUntil: new Date(),
            isArchived: false,
            archivedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
      },
      companySettings: {
        findMany: vi.fn(() =>
          Promise.resolve([
            { key: "company_name", value: "BOB Solar" },
            { key: "company_address", value: "123 Solar St" },
          ]),
        ),
      },
    },
  },
}));

vi.mock("@/actions/settings-actions", () => ({
  getCompanyLogoUrl: vi.fn(() => Promise.resolve(null)),
}));

describe("PDF route: HTML print page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns text/html content type instead of application/pdf", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync(
      require.resolve("../../src/app/(dashboard)/quotations/[id]/pdf/route.ts"),
      "utf-8",
    );

    expect(src).toMatch(/Content-Type.*text\/html/);
    expect(src).not.toMatch(/application\/pdf/);
  });

  it("uses QuoteHtml component instead of @react-pdf/renderer", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync(
      require.resolve("../../src/app/(dashboard)/quotations/[id]/pdf/route.ts"),
      "utf-8",
    );

    expect(src).toMatch(/QuoteHtml/);
    expect(src).not.toMatch(/@react-pdf\/renderer/);
    expect(src).not.toMatch(/renderToStream/);
    expect(src).not.toMatch(/pdfBuffer/);
  });

  it("handles errors gracefully with catch block", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync(
      require.resolve("../../src/app/(dashboard)/quotations/[id]/pdf/route.ts"),
      "utf-8",
    );

    expect(src).toMatch(/catch\s*\(error\)/);
    expect(src).toMatch(/Failed to generate print page/);
  });

  it("does NOT use Readable stream from Node.js", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync(
      require.resolve("../../src/app/(dashboard)/quotations/[id]/pdf/route.ts"),
      "utf-8",
    );

    expect(src).not.toMatch(/import.*Readable/);
    expect(src).not.toMatch(/for await/);
  });

  it("does NOT import from @react-pdf/renderer in html component", async () => {
    const fs = await import("node:fs");
    const componentSrc = fs.readFileSync(
      require.resolve("../../src/components/pdf/quote-html.tsx"),
      "utf-8",
    );

    expect(componentSrc).not.toMatch(/@react-pdf/);
  });
});

// ─── Test Suite 3: next.config.mjs cleanup ────────────────────────────────

describe("next.config.mjs cleanup", () => {
  it("no longer lists @react-pdf/renderer in serverExternalPackages", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync(require.resolve("../../next.config.mjs"), "utf-8");

    expect(src).not.toMatch(/@react-pdf\/renderer/);
  });
});

// ─── Test Suite 4: Unused packages are confirmed absent ───────────────────
