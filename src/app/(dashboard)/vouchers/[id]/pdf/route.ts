import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/validate';
import { uuidSchema } from '@/lib/validators/common';
import { VoucherHtml } from '@/components/pdf/voucher-html';

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

    const voucher = await db.query.projectVouchers.findFirst({
      where: (vouchers, { eq }) => eq(vouchers.id, validatedId),
      with: {
        project: {
          columns: { projectNumber: true },
          with: {
            customer: { columns: { name: true, address: true, city: true } },
          },
        },
      },
    });

    if (!voucher) {
      return NextResponse.json({ error: 'Voucher not found' }, { status: 404 });
    }

    const settingsRows = await db.query.companySettings.findMany();
    const companySettings = settingsRows.reduce<Record<string, string>>(
      (acc, row) => {
        acc[row.key] = row.value;
        return acc;
      },
      {},
    );

    const customer = voucher.project.customer;
    const customerAddress = [customer.address, customer.city]
      .filter(Boolean)
      .join(', ');

    const html = VoucherHtml({
      voucher: {
        ...voucher,
        projectNumber: voucher.project.projectNumber,
        customerName: customer.name,
      },
      customerAddress,
      companySettings,
    });

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Voucher print page generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate print page' },
      { status: 500 },
    );
  }
}
