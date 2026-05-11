import { NextRequest, NextResponse } from 'next/server';
import { renderToStream } from '@react-pdf/renderer';
import { QuoteDocument } from '@/components/pdf/quote-document';
import { db } from '@/lib/db';
import { quotations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { getCompanyLogoUrl } from '@/actions/settings-actions';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Authenticate request
    const sessionToken = request.cookies.get('session_id')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await getSession(sessionToken);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get quotation ID from params
    const { id } = await params;

    // Fetch quotation with items and customer
    const quotation = await db.query.quotations.findFirst({
      where: eq(quotations.id, id),
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
        'Content-Disposition': `inline; filename="${quotation.quoteNumber}.pdf"`,
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
