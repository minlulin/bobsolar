import { format } from "date-fns";
import {
  COMPANY_SETTING_DEFAULTS,
  COMPANY_SETTING_KEYS,
  formatBankDetails,
} from "@/lib/domain/settings-keys";
import { formatMMK } from "@/lib/utils";
import type { GroupableItem } from "@/lib/utils/quotation-grouping";
import { groupQuotationItems } from "@/lib/utils/quotation-grouping";

interface QuoteHtmlCustomer {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  address: string | null;
  city: string | null;
}

interface QuoteHtmlItem extends GroupableItem {}

interface QuoteHtmlInput {
  id: string;
  quoteNumber: string;
  subtotal: string;
  discountPercent: string;
  discountAmount: string;
  taxPercent: string;
  taxAmount: string;
  total: string;
  notes: string | null;
  createdAt: Date;
  validUntil: Date | null;
  items: QuoteHtmlItem[];
  customer: QuoteHtmlCustomer;
}

interface QuoteHtmlProps {
  quotation: QuoteHtmlInput;
  companyLogoUrl?: string | null;
  companySettings?: Record<string, string>;
  type?: "quotation" | "voucher";
}

export function QuoteHtml({
  quotation,
  companyLogoUrl,
  companySettings = {},
  type = "quotation",
}: QuoteHtmlProps): string {
  const { customer, items } = quotation;

  const companyName =
    companySettings[COMPANY_SETTING_KEYS.NAME] ||
    COMPANY_SETTING_DEFAULTS[COMPANY_SETTING_KEYS.NAME];
  const companyAddress =
    companySettings[COMPANY_SETTING_KEYS.ADDRESS] ||
    COMPANY_SETTING_DEFAULTS[COMPANY_SETTING_KEYS.ADDRESS];
  const companyPhone =
    companySettings[COMPANY_SETTING_KEYS.PHONE] ||
    COMPANY_SETTING_DEFAULTS[COMPANY_SETTING_KEYS.PHONE];
  const companyEmail =
    companySettings[COMPANY_SETTING_KEYS.EMAIL] ||
    COMPANY_SETTING_DEFAULTS[COMPANY_SETTING_KEYS.EMAIL];

  const bankDetailsText = formatBankDetails(companySettings);

  const title = type === "voucher" ? "PAYMENT VOUCHER" : "FORMAL QUOTATION";
  const accent = "#F59E0B";
  const accentDark = "#D97706";
  const primary = "#0F172A";
  const slate = "#64748B";
  const light = "#F8FAFC";
  const border = "#E2E8F0";
  const successGreen = "#059669";

  const displayItems = groupQuotationItems(items);

  const itemsHtml = displayItems
    .map((item, index) => {
      const isFree = Number(item.unitPrice) === 0;
      const priceDisplay = isFree
        ? `<span style="color:${successGreen};font-weight:700;">FREE</span>`
        : formatMMK(Number(item.unitPrice));
      const totalDisplay = isFree
        ? `<span style="color:${successGreen};font-weight:700;">FREE</span>`
        : formatMMK(Number(item.totalPrice));
      const isEven = index % 2 === 0;
      const categoryPrefix = item.category ? `[${String(item.category).toUpperCase()}] ` : "";

      return `<tr style="background:${isEven ? "white" : light};">
          <td style="padding:9px 12px;border-bottom:1px solid ${border};font-size:11px;font-weight:600;color:${primary};word-break:break-word;">${categoryPrefix}${item.description}</td>
          <td style="padding:9px 12px;border-bottom:1px solid ${border};font-size:11px;text-align:center;font-weight:600;color:${slate};width:60px;">${Number(item.quantity)}</td>
          <td style="padding:9px 12px;border-bottom:1px solid ${border};font-size:11px;text-align:right;color:${slate};width:110px;">${priceDisplay}</td>
          <td style="padding:9px 12px;border-bottom:1px solid ${border};font-size:11px;text-align:right;font-weight:700;color:${primary};width:120px;">${totalDisplay}</td>
        </tr>`;
    })
    .join("\n");

  const discountHtml =
    Number(quotation.discountPercent) > 0
      ? `<tr>
          <td style="padding:6px 0;font-size:11px;color:${slate};">Incentive (${quotation.discountPercent}%)</td>
          <td style="padding:6px 0;font-size:11px;text-align:right;color:#EF4444;font-weight:600;">-${formatMMK(Number(quotation.discountAmount))}</td>
        </tr>`
      : "";

  const taxHtml =
    Number(quotation.taxPercent) > 0
      ? `<tr>
          <td style="padding:6px 0;font-size:11px;color:${slate};">Commercial Tax (${quotation.taxPercent}%)</td>
          <td style="padding:6px 0;font-size:11px;text-align:right;color:${primary};font-weight:600;">+${formatMMK(Number(quotation.taxAmount))}</td>
        </tr>`
      : "";

  const notesHtml = quotation.notes
    ? `<div style="margin-bottom:14px;">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${accent};margin-bottom:6px;">Terms &amp; Conditions</div>
        <div style="font-size:10px;color:${slate};line-height:1.6;">${quotation.notes.replace(/\n/g, "<br/>")}</div>
      </div>`
    : "";

  const bankHtml = bankDetailsText
    ? `<div style="margin-bottom:14px;">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${accent};margin-bottom:6px;">Payment Instructions</div>
        <div style="font-size:10px;color:${slate};line-height:1.6;">${bankDetailsText.replace(/\n/g, "<br/>")}</div>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${companyName} - ${title} ${quotation.quoteNumber}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 12px;
      color: ${primary};
      background: #E5E7EB;
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    @page {
      size: A4;
      margin: 12mm 14mm 14mm 14mm;
    }

    /* Screen toolbar */
    .screen-toolbar {
      position: fixed; top: 0; left: 0; right: 0;
      background: ${primary}; color: white;
      padding: 10px 24px; display: flex; align-items: center; justify-content: center; gap: 12px;
      z-index: 1000; font-size: 12px;
    }
    .btn {
      padding: 7px 16px; border-radius: 5px; font-weight: 700;
      cursor: pointer; border: none; font-size: 11px; letter-spacing: 0.3px;
    }
    .btn-primary { background: ${accent}; color: white; }
    .btn-secondary { background: rgba(255,255,255,0.15); color: white; }

    /* Page wrapper — screen only */
    .page-wrapper {
      padding: 70px 0 30px;
    }

    /* A4 page card */
    .page-card {
      width: 210mm;
      margin: 0 auto;
      background: white;
      box-shadow: 0 4px 32px rgba(0,0,0,0.14);
      border-radius: 4px;
      overflow: hidden;
    }

    /* Top accent stripe */
    .top-stripe {
      height: 6px;
      background: linear-gradient(90deg, ${accent} 0%, ${accentDark} 100%);
    }

    /* Content padding */
    .doc-body {
      padding: 20px 24px 24px;
    }

    /* ────────────────────────────────
       HEADER: one tight row
    ──────────────────────────────── */
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 14px;
      padding-bottom: 14px;
      border-bottom: 1px solid ${border};
    }

    .brand-col {
      display: flex;
      align-items: flex-start;
      gap: 10px;
    }
    .brand-logo { height: 40px; width: auto; object-fit: contain; }
    .logo-placeholder {
      background: ${primary}; color: white;
      width: 40px; height: 40px; border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      font-weight: 900; font-size: 14px; flex-shrink: 0;
    }
    .brand-text { }
    .brand-name { font-size: 14px; font-weight: 700; color: ${primary}; line-height: 1.2; margin-bottom: 3px; }
    .brand-meta { font-size: 9px; color: ${slate}; line-height: 1.6; }

    .doc-col { text-align: right; }
    .doc-title {
      font-size: 20px; font-weight: 900; color: ${primary};
      letter-spacing: 0.5px; line-height: 1; margin-bottom: 10px;
      text-transform: uppercase;
    }
    .doc-badge {
      display: inline-block;
      background: ${accent};
      color: white;
      font-size: 9px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 20px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 10px;
    }
    .meta-grid {
      display: inline-grid;
      grid-template-columns: auto auto;
      gap: 2px 10px;
      font-size: 9.5px;
      text-align: left;
    }
    .meta-label { color: ${slate}; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; }
    .meta-value { color: ${primary}; font-weight: 700; text-align: right; }

    /* ────────────────────────────────
       CUSTOMER STRIP: compact single row
    ──────────────────────────────── */
    .customer-strip {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: ${light};
      border: 1px solid ${border};
      border-left: 3px solid ${accent};
      border-radius: 5px;
      padding: 10px 14px;
      margin-bottom: 16px;
    }
    .customer-label {
      font-size: 8.5px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.8px; color: ${slate}; margin-bottom: 2px;
    }
    .customer-name { font-size: 13px; font-weight: 700; color: ${primary}; }
    .customer-meta { font-size: 9.5px; color: ${slate}; margin-top: 2px; }

    /* ────────────────────────────────
       ITEMS TABLE
    ──────────────────────────────── */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 0;
      page-break-inside: auto;
    }
    .items-table thead {
      display: table-header-group;
    }
    .items-table th {
      padding: 8px 12px;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: white;
      background: ${primary};
      text-align: left;
    }
    .items-table th:first-child { border-radius: 5px 0 0 5px; }
    .items-table th:last-child { border-radius: 0 5px 5px 0; }
    .items-table tbody tr { page-break-inside: avoid; }
    .items-table td {
      padding: 9px 12px;
      border-bottom: 1px solid ${border};
      font-size: 11px;
      vertical-align: middle;
    }
    .items-table tbody tr:last-child td { border-bottom: none; }

    /* ────────────────────────────────
       SUMMARY SECTION
    ──────────────────────────────── */
    .summary-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-top: 16px;
      gap: 16px;
      page-break-inside: avoid;
    }
    .summary-left { flex: 1; min-width: 0; }
    .summary-right { width: 200px; flex-shrink: 0; }

    .totals-table { width: 100%; border-collapse: collapse; }
    .totals-table td { padding: 5px 0; font-size: 11px; }
    .totals-table td:last-child { text-align: right; font-weight: 600; }
    .totals-divider { border-top: 1px solid ${border}; }
    .grand-row td { padding-top: 10px !important; }
    .grand-label { font-size: 12px !important; font-weight: 700 !important; color: ${primary} !important; }
    .grand-value { font-size: 16px !important; font-weight: 900 !important; color: ${accent} !important; }

    /* ────────────────────────────────
       SIGNATURES
    ──────────────────────────────── */
    .signature-row {
      display: flex;
      justify-content: space-between;
      margin-top: 28px;
      page-break-inside: avoid;
    }
    .sig-box {
      width: 42%;
      border-top: 1px solid ${primary};
      padding-top: 6px;
      text-align: center;
    }
    .sig-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: ${slate}; }

    /* ────────────────────────────────
       FOOTER
    ──────────────────────────────── */
    .doc-footer {
      margin-top: 20px;
      padding-top: 10px;
      border-top: 1px solid ${border};
      text-align: center;
      font-size: 8.5px;
      color: #9CA3AF;
      page-break-inside: avoid;
    }

    /* ────────────────────────────────
       PRINT OVERRIDES
    ──────────────────────────────── */
    @media print {
      body { background: white; }
      .screen-toolbar { display: none !important; }
      .page-wrapper { padding: 0; }
      .page-card { width: 100%; box-shadow: none; border-radius: 0; }
      .top-stripe { display: none; }
      .doc-body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="screen-toolbar">
    <span style="font-weight:600;opacity:0.75;font-size:11px;">PREVIEW</span>
    <button class="btn btn-primary" onclick="window.print()">&#128438; PRINT / SAVE PDF</button>
    <button class="btn btn-secondary" onclick="window.close()">&#x2715; CLOSE</button>
  </div>

  <div class="page-wrapper">
    <div class="page-card">
      <div class="top-stripe"></div>
      <div class="doc-body">

        <!-- HEADER ROW -->
        <div class="header-row">
          <div class="brand-col">
            ${
              companyLogoUrl
                ? `<img src="${companyLogoUrl}" class="brand-logo" alt="Logo" />`
                : `<div class="logo-placeholder">&#9728;</div>`
            }
            <div class="brand-text">
              <div class="brand-name">${companyName}</div>
              <div class="brand-meta">
                ${companyAddress ? `${companyAddress.replace(/\n/g, " &bull; ")}<br/>` : ""}
                ${companyPhone}${companyEmail ? ` &bull; ${companyEmail}` : ""}
              </div>
            </div>
          </div>
          <div class="doc-col">
            <div class="doc-title">${title}</div>
            <div class="meta-grid">
              <span class="meta-label">Reference</span>
              <span class="meta-value">${quotation.quoteNumber}</span>
              <span class="meta-label">Date</span>
              <span class="meta-value">${format(new Date(quotation.createdAt), "dd MMM yyyy")}</span>
              ${
                quotation.validUntil
                  ? `<span class="meta-label">Valid Until</span>
              <span class="meta-value">${format(new Date(quotation.validUntil), "dd MMM yyyy")}</span>`
                  : ""
              }
            </div>
          </div>
        </div>

        <!-- CUSTOMER STRIP -->
        <div class="customer-strip">
          <div>
            <div class="customer-label">Prepared For</div>
            <div class="customer-name">${customer.name}</div>
            <div class="customer-meta">
              ${[customer.address?.replace(/\n/g, ", "), customer.city, customer.phone, customer.email].filter(Boolean).join(" &bull; ")}
            </div>
          </div>
          <div style="text-align:right;">
            <div class="customer-label" style="margin-bottom:4px;">Document Status</div>
            <div class="doc-badge">Active</div>
          </div>
        </div>

        <!-- ITEMS TABLE -->
        <table class="items-table">
          <thead>
            <tr>
              <th>Description</th>
              <th style="text-align:center;width:60px;">Qty</th>
              <th style="text-align:right;width:110px;">Unit Price</th>
              <th style="text-align:right;width:120px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <!-- SUMMARY ROW -->
        <div class="summary-row">
          <div class="summary-left">
            ${bankHtml}
            ${notesHtml}
          </div>
          <div class="summary-right">
            <table class="totals-table">
              <tr>
                <td style="color:${slate};">Subtotal</td>
                <td>${formatMMK(Number(quotation.subtotal))}</td>
              </tr>
              ${discountHtml}
              ${taxHtml}
              <tr class="totals-divider grand-row">
                <td class="grand-label">Total Amount</td>
                <td class="grand-value">${formatMMK(Number(quotation.total))}</td>
              </tr>
            </table>
          </div>
        </div>

        <!-- SIGNATURES -->
        <div class="signature-row">
          <div class="sig-box">
            <div class="sig-label">Customer Signature &amp; Stamp</div>
          </div>
          <div class="sig-box">
            <div class="sig-label">Authorized Signatory</div>
          </div>
        </div>

        <!-- FOOTER -->
        <div class="doc-footer">
          Generated by BOB Solar Infrastructure System &bull; Myanmar &bull; This is a computer-generated document.
        </div>

      </div>
    </div>
  </div>
</body>
</html>`;
}
