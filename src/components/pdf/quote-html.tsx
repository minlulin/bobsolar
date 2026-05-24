import { format } from "date-fns";
import { COMPANY_SETTING_DEFAULTS, COMPANY_SETTING_KEYS } from "@/lib/domain/settings-keys";
import { formatMMK } from "@/lib/utils";

interface QuoteHtmlCustomer {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  address: string | null;
  city: string | null;
}

interface QuoteHtmlItem {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
}

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

  const title = type === "voucher" ? "VOUCHER" : "QUOTATION";

  const itemsHtml = items
    .map(
      (item) => `
      <tr class="item-row">
        <td class="cell cell-desc">
          <div class="item-title">${item.description}</div>
        </td>
        <td class="cell cell-qty">${Number(item.quantity)}</td>
        <td class="cell cell-price">${formatMMK(Number(item.unitPrice))}</td>
        <td class="cell cell-total">${formatMMK(Number(item.totalPrice))}</td>
      </tr>`,
    )
    .join("\n          ");

  const discountHtml =
    Number(quotation.discountPercent) > 0
      ? `
          <div class="totals-row">
            <span class="totals-label">Incentive Applied (${quotation.discountPercent}%)</span>
            <span class="totals-value discount">-${formatMMK(Number(quotation.discountAmount))}</span>
          </div>`
      : "";

  const taxHtml =
    Number(quotation.taxPercent) > 0
      ? `
          <div class="totals-row">
            <span class="totals-label">Commercial Tax (${quotation.taxPercent}%)</span>
            <span class="totals-value">+${formatMMK(Number(quotation.taxAmount))}</span>
          </div>`
      : "";

  const notesHtml =
    quotation.notes && type === "quotation"
      ? `
        <div class="notes-section">
          <div class="notes-title">Terms & Technical Conditions</div>
          <p class="notes-content">${quotation.notes}</p>
        </div>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${companyName} - ${title} ${quotation.quoteNumber}</title>
  <style>
    :root {
      --primary: #0F172A;
      --accent: #D97706;
      --slate: #64748B;
      --border: #E2E8F0;
    }
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      font-size: 11px;
      color: var(--primary);
      line-height: 1.6;
      -webkit-print-color-adjust: exact;
    }

    @page {
      size: A4;
      margin: 20mm;
    }

    .screen-toolbar {
      position: fixed; top: 0; left: 0; right: 0;
      background: var(--primary); color: white;
      padding: 12px 24px; display: flex; justify-content: center; gap: 15px;
      z-index: 1000;
    }

    .btn {
      padding: 8px 16px; border-radius: 8px; font-weight: 700; cursor: pointer; border: none;
    }
    .btn-primary { background: var(--accent); color: white; }
    .btn-secondary { background: rgba(255,255,255,0.1); color: white; }

    .print-area {
      max-width: 210mm; margin: 0 auto; padding: 60px 40px;
    }

    @media print {
      .screen-toolbar { display: none !important; }
      .print-area { padding: 0; }
    }

    /* Header Design */
    .header {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 40px; border-bottom: 3px solid var(--primary); padding-bottom: 30px;
    }

    .brand-section { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
    .brand-logo {
      height: 36px;
      width: auto;
      object-fit: contain;
    }
    .logo-placeholder { 
      background: var(--primary); color: white; width: 36px; height: 36px;
      display: flex; align-items: center; justify-content: center; border-radius: 8px;
      font-weight: 900; font-size: 14px;
    }
    .brand-name { font-size: 22px; font-weight: 900; letter-spacing: -1px; text-transform: uppercase; color: var(--primary); }
    
    .company-details { font-size: 8px; color: var(--slate); text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; }

    .doc-info { text-align: right; }
    .doc-type { font-size: 32px; font-weight: 900; color: #E2E8F0; text-transform: uppercase; line-height: 1; margin-bottom: 5px; }
    .doc-id { font-size: 14px; font-weight: 900; color: var(--accent); }
    .doc-date { font-size: 9px; color: var(--slate); font-weight: 700; }

    /* Client Section */
    .client-section { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
    .section-label { 
      font-size: 8px; font-weight: 900; color: var(--accent); 
      text-transform: uppercase; letter-spacing: 2px; border-bottom: 1px solid var(--border);
      padding-bottom: 5px; margin-bottom: 10px;
    }
    .client-name { font-size: 16px; font-weight: 900; color: var(--primary); margin-bottom: 5px; }
    .client-meta { font-size: 9px; color: var(--slate); font-weight: 500; }

    /* Table Design */
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    th { 
      text-align: left; padding: 12px 0; font-size: 8px; font-weight: 900; 
      color: var(--slate); text-transform: uppercase; letter-spacing: 1px;
      border-bottom: 2px solid var(--primary);
    }
    td { padding: 15px 0; border-bottom: 1px solid var(--border); vertical-align: top; }
    
    .item-title { font-size: 11px; font-weight: 800; color: var(--primary); }
    .cell-qty { width: 60px; text-align: center; font-weight: 700; color: var(--slate); }
    .cell-price { width: 120px; text-align: right; font-weight: 700; color: var(--slate); }
    .cell-total { width: 120px; text-align: right; font-weight: 900; color: var(--primary); }

    /* Totals */
    .summary-section { display: flex; justify-content: flex-end; margin-bottom: 40px; }
    .totals-box { width: 240px; }
    .totals-row { display: flex; justify-content: space-between; padding: 5px 0; font-weight: 700; }
    .totals-label { color: var(--slate); font-size: 9px; text-transform: uppercase; }
    .grand-total { border-top: 2px solid var(--primary); margin-top: 10px; padding-top: 10px; }
    .grand-total-val { font-size: 20px; font-weight: 900; color: var(--primary); letter-spacing: -0.5px; }

    /* Notes & Footer */
    .notes-section { margin-top: 50px; }
    .notes-title { font-size: 9px; font-weight: 900; text-transform: uppercase; color: var(--accent); margin-bottom: 10px; }
    .notes-content { font-size: 9px; color: var(--slate); max-width: 400px; line-height: 1.8; }

    .signature-section { 
      display: flex; justify-content: space-between; align-items: flex-end; 
      margin-top: 80px; padding-top: 20px;
    }
    .sig-box { width: 180px; border-top: 1px solid var(--border); padding-top: 10px; }
    .sig-label { font-size: 8px; font-weight: 900; text-transform: uppercase; color: var(--primary); letter-spacing: 1px; }

    .footer { 
      margin-top: 60px; text-align: center; border-top: 1px solid var(--border); 
      padding-top: 20px; font-size: 8px; color: var(--slate); font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="screen-toolbar">
    <span style="font-weight: 900; opacity: 0.6; letter-spacing: 1px;">PREVIEW MODE</span>
    <button class="btn btn-primary" onclick="window.print()">PRINT DOCUMENT</button>
    <button class="btn btn-secondary" onclick="window.close()">CLOSE WINDOW</button>
  </div>

  <div class="print-area">
    <div class="header">
      <div>
        <div class="brand-section">
          ${
            companyLogoUrl
              ? `<img src="${companyLogoUrl}" class="brand-logo" alt="Logo" />`
              : `<div class="logo-placeholder">BS</div>`
          }
          <span class="brand-name">${companyName}</span>
        </div>
        <div class="company-details">
          Energy Infrastructure &amp; Installation<br/>
          Premium Service Division<br/>
          ${companyAddress}<br/>
          ${companyPhone} &bull; ${companyEmail}
        </div>
      </div>
      <div class="doc-info">
        <div class="doc-type">${title}</div>
        <div class="doc-id">${quotation.quoteNumber}</div>
        <div class="doc-date">${format(new Date(quotation.createdAt), "MMMM dd, yyyy")}</div>
      </div>
    </div>

    <div class="client-section">
      <div>
        <div class="section-label">Prepared For</div>
        <div class="client-name">${customer.name}</div>
        <div class="client-meta">
          ${customer.phone} ${customer.email ? ` &bull; ${customer.email}` : ""}<br/>
          ${customer.address}${customer.city ? `, ${customer.city}` : ""}
        </div>
      </div>
      <div>
        <div class="section-label">Validity & Terms</div>
        <div class="client-meta">
          <strong>Valid Until:</strong> ${quotation.validUntil ? format(new Date(quotation.validUntil), "MMM dd, yyyy") : "N/A"}<br/>
          <strong>Project Ref:</strong> ${quotation.quoteNumber}<br/>
          <strong>Currency:</strong> Myanmar Kyat (MMK)
        </div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Component Description</th>
          <th style="text-align:center">Qty</th>
          <th style="text-align:right">Unit Price</th>
          <th style="text-align:right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <div class="summary-section">
      <div class="totals-box">
        <div class="totals-row">
          <span class="totals-label">Subtotal</span>
          <span>${formatMMK(Number(quotation.subtotal))}</span>
        </div>
        ${discountHtml}
        ${taxHtml}
        <div class="totals-row grand-total">
          <span class="totals-label" style="color:var(--primary)">Project Total</span>
          <span class="grand-total-val">${formatMMK(Number(quotation.total))}</span>
        </div>
      </div>
    </div>

    ${notesHtml}

    <div class="signature-section">
      <div class="sig-box">
        <div class="sig-label">Customer Acceptance</div>
      </div>
      <div class="sig-box">
        <div class="sig-label">Authorized Signatory</div>
      </div>
    </div>

    <div class="footer">
      This document is a formal proposal. All hardware specifications are subject to final site survey.<br/>
      Generated by BOB Solar Infrastructure System &bull; Yangon, Myanmar
    </div>
  </div>
</body>
</html>`;
}
