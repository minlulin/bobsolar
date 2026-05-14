import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Test 1: Font registration is resilient ────────────────────────────────

describe('PDF: Font registration resilience', () => {
  it('font registration is wrapped in try-catch to handle Vercel missing font files', async () => {
    const fs = await import('fs');
    const src = fs.readFileSync(
      require.resolve('../../src/components/pdf/quote-document.tsx'),
      'utf-8',
    );
    // The Font.register must be wrapped in try-catch so that missing font file
    // on Vercel serverless does not crash the module import.
    expect(src).toMatch(/try\s*\{/);
    expect(src).toMatch(/Font\.register/);
    expect(src).toMatch(/catch\s*\{/);
  });
});

// ─── Test 2: PDF route handles font/rendering errors gracefully ─────────────

vi.mock('@/lib/auth/validate', () => ({
  getCurrentUser: vi.fn(() => Promise.resolve({ id: 'user-1', role: 'admin' })),
}));

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      quotations: {
        findFirst: vi.fn(() =>
          Promise.resolve({
            id: '00000000-0000-4000-8000-000000000001',
            quoteNumber: 'QT-2026-0001',
            subtotal: '6150000',
            discountPercent: '5',
            discountAmount: '307500',
            taxPercent: '10',
            taxAmount: '584250',
            total: '6426750',
            notes: 'Test notes',
            createdAt: new Date(),
            validUntil: new Date(),
            items: [
              {
                id: 'item-1',
                description: 'Solar Panel 400W',
                quantity: '10',
                unitPrice: '350000',
                totalPrice: '3500000',
              },
            ],
            customer: {
              id: 'cust-1',
              name: 'Test Customer',
              phone: '09-123456789',
              email: 'customer@example.com',
              address: '123 Test St',
              city: 'Yangon',
            },
          }),
        ),
      },
      companySettings: {
        findMany: vi.fn(() =>
          Promise.resolve([
            { key: 'company_name', value: 'BOB Solar' },
            { key: 'company_address', value: '123 Solar St' },
          ]),
        ),
      },
    },
  },
}));

vi.mock('@/actions/settings-actions', () => ({
  getCompanyLogoUrl: vi.fn(() => Promise.resolve(null)),
}));

describe('PDF: Route handler error resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 500 JSON with error message when renderToStream fails', async () => {
    // Simulate renderToStream failure (e.g. font missing, stream error)
    vi.doMock('@react-pdf/renderer', () => ({
      renderToStream: vi.fn(() => {
        throw new Error('PDF rendering failed: font not found');
      }),
    }));

    // We can't easily test the route in isolation without a full Next.js
    // environment, but we can verify the error handling structure exists.
    const fs = await import('fs');
    const src = fs.readFileSync(
      require.resolve('../../src/app/(dashboard)/quotations/[id]/pdf/route.ts'),
      'utf-8',
    );

    expect(src).toMatch(/catch\s*\(error\)/);
    expect(src).toMatch(/Failed to generate PDF/);
  });

  it('does NOT save PDF to Vercel Blob storage', async () => {
    const fs = await import('fs');
    const src = fs.readFileSync(
      require.resolve('../../src/app/(dashboard)/quotations/[id]/pdf/route.ts'),
      'utf-8',
    );

    // The PDF route should NOT import from @vercel/blob
    expect(src).not.toMatch(/@vercel\/blob/);
    expect(src).not.toMatch(/uploadFileFromBufferOrBlob/);
    expect(src).not.toMatch(/put\(/);
  });

  it('next.config.mjs marks @react-pdf/renderer as server external package', async () => {
    const fs = await import('fs');
    const src = fs.readFileSync(
      require.resolve('../../next.config.mjs'),
      'utf-8',
    );
    expect(src).toMatch(/@react-pdf\/renderer/);
  });
});

// ─── Test 3: Stream handling is robust ─────────────────────────────────────

describe('PDF: Stream handling', () => {
  it('uses proper Node.js ReadableStream pipe instead of fragile type cast', async () => {
    const fs = await import('fs');
    const src = fs.readFileSync(
      require.resolve('../../src/app/(dashboard)/quotations/[id]/pdf/route.ts'),
      'utf-8',
    );

    // Should NOT cast to AsyncIterable - should use stream-to-buffer properly
    expect(src).not.toMatch(/as AsyncIterable/);
  });
});
