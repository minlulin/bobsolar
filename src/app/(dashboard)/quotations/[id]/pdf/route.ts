import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { quotations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/validate';
import { getCompanyLogoUrl } from '@/actions/settings-actions';
import { uuidSchema } from '@/lib/validators/common';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    if (!(await getCurrentUser())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const validatedId = uuidSchema.parse(id);

    // Fetch quotation with items and customer
    const quotation = await db.query.quotations.findFirst({
      where: eq(quotations.id, validatedId),
      with: {
        items: true,
        customer: true,
      },
    });

    if (!quotation) {
      return NextResponse.json(
        { error: 'Quotation not found' },
        { status: 404 },
      );
    }

    const companyLogoUrl = await getCompanyLogoUrl();
    const settingsRows = await db.query.companySettings.findMany();
    const companySettings = settingsRows.reduce<Record<string, string>>(
      (acc, row) => {
        acc[row.key] = row.value;
        return acc;
      },
      {},
    );

    const [{ renderToStream }, { QuoteDocument }] = await Promise.all([
      import('@react-pdf/renderer'),
      import('@/components/pdf/quote-document'),
    ]);

    // Render PDF
    const pdfStream = await renderToStream(
      QuoteDocument({
        quotation: quotation,
        companyLogoUrl,
        companySettings,
      }),
    );

    // Convert stream to array buffer
    const chunks: Uint8Array[] = [];

    // Use the reader from the web ReadableStream
    for await (const chunk of pdfStream as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }

    const pdfBuffer = Buffer.concat(chunks);

    // Return PDF response
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${quotation.quoteNumber}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 },
    );
  }
}
