import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { getCompanyLogoUrl } from "@/actions/settings-actions";
import { QuoteHtml } from "@/components/pdf/quote-html";
import { getCurrentUser } from "@/lib/auth/validate";
import { db } from "@/lib/db";
import { quotations } from "@/lib/db/schema";
import { uuidSchema } from "@/lib/validators/common";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    if (!(await getCurrentUser())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    }

    const companyLogoUrl = await getCompanyLogoUrl();
    const settingsRows = await db.query.companySettings.findMany();
    const companySettings = settingsRows.reduce<Record<string, string>>((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});

    // Render as HTML with print-optimized styles
    const html = QuoteHtml({
      quotation,
      companyLogoUrl,
      companySettings,
      type: "quotation",
    });

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Print page generation error:", error);
    return NextResponse.json({ error: "Failed to generate print page" }, { status: 500 });
  }
}
