import { formatMMK } from '@/lib/utils';
import { format } from 'date-fns';
import {
  COMPANY_SETTING_KEYS,
  COMPANY_SETTING_DEFAULTS,
  formatBankDetails,
} from '@/lib/domain/settings-keys';

const DEFAULT_TAGLINE = 'Powering Tomorrow with Solar Energy';

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
  type?: 'quotation' | 'voucher';
}

export function QuoteHtml({
  quotation,
  companyLogoUrl,
  companySettings = {},
  type = 'quotation',
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
  const companyTaxId =
    companySettings[COMPANY_SETTING_KEYS.TAX_ID] ||
    COMPANY_SETTING_DEFAULTS[COMPANY_SETTING_KEYS.TAX_ID];

  const title = type === 'voucher' ? 'VOUCHER' : 'QUOTATION';
  const validUntilLabel = type === 'voucher' ? 'Expires On' : 'Valid Until';

  const itemsHtml = items
    .map(
      (item, index) => `
      <tr class="${index % 2 === 0 ? 'row-even' : ''}">
        <td class="cell cell-num">${index + 1}</td>
        <td class="cell cell-desc">${item.description}</td>
        <td class="cell cell-qty">${Number(item.quantity).toFixed(2)}</td>
        <td class="cell cell-unit">MMK</td>
        <td class="cell cell-price">${formatMMK(Number(item.unitPrice))}</td>
        <td class="cell cell-total">${formatMMK(Number(item.totalPrice))}</td>
      </tr>`,
    )
    .join('\n          ');

  const discountHtml =
    Number(quotation.discountPercent) > 0
      ? `
          <div class="totals-row">
            <span class="totals-label discount">Discount (${quotation.discountPercent}%)</span>
            <span class="totals-value discount">-${formatMMK(Number(quotation.discountAmount))}</span>
          </div>`
      : '';

  const taxHtml =
    Number(quotation.taxPercent) > 0
      ? `
          <div class="totals-row">
            <span class="totals-label tax">Commercial Tax (${quotation.taxPercent}%)</span>
            <span class="totals-value tax">+${formatMMK(Number(quotation.taxAmount))}</span>
          </div>`
      : '';

  const notesHtml =
    quotation.notes && type === 'quotation'
      ? `
        <div class="notes-section">
          <h2 class="section-title">Notes & Terms</h2>
          <p class="notes-content">${quotation.notes}</p>
        </div>`
      : '';

  const logoHtml = companyLogoUrl
    ? `<img src="${companyLogoUrl}" alt="${companyName}" class="company-logo" />`
    : '';

  return `<!DOCTYPE html>
<html lang="my">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${companyName} - ${title} ${quotation.quoteNumber}</title>
  <style>
    @font-face {
      font-family: 'Inter';
      src: url('/fonts/inter-regular.woff2') format('woff2');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Inter';
      src: url('/fonts/inter-semibold.woff2') format('woff2');
      font-weight: 600;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Inter';
      src: url('/fonts/inter-bold.woff2') format('woff2');
      font-weight: 700;
      font-style: normal;
      font-display: swap;
    }

    /* Print-optimized A4 styles */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      /* Font stack: Inter for Latin, then Burmese-capable fallbacks:
         - Padauk / Noto Sans Myanmar: common on Linux/Android
         - Myanmar Text: Windows 10+
         - Myanmar Sangam MN: macOS/iOS
         - Noto Sans Myanmar: Google Fonts system fallback
      */
      font-family: 'Inter', 'Padauk', 'Noto Sans Myanmar', 'Myanmar Text', 'Myanmar Sangam MN', sans-serif;
      font-size: 10pt;
      color: #121212;
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    @media print {
      @page {
        size: A4;
        margin: 15mm 20mm;
      }

      body {
        font-size: 9pt;
      }

      .no-print {
        display: none !important;
      }

      .page-break {
        page-break-before: always;
      }

      a {
        text-decoration: none;
        color: inherit;
      }
    }

    /* Screen-only styles */
    .screen-toolbar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 12px 24px;
      background: #121212;
      color: #fff;
      font-size: 14px;
    }

    .screen-toolbar button {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 20px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
    }

    .screen-toolbar button:hover {
      opacity: 0.9;
    }

    .screen-toolbar .btn-primary {
      background: #F59E0B;
      color: #121212;
    }

    .screen-toolbar .btn-secondary {
      background: #27272A;
      color: #fff;
    }

    .screen-toolbar .btn-secondary:hover {
      background: #3F3F46;
    }

    .print-area {
      max-width: 210mm;
      margin: 0 auto;
      padding: 60px 40px 80px;
    }

    @media print {
      .print-area {
        padding: 0;
        max-width: none;
      }
    }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #F59E0B;
    }

    .header-left {
      flex: 1;
    }

    .company-logo {
      width: 72px;
      max-height: 72px;
      object-fit: contain;
      margin-bottom: 10px;
    }

    .company-name {
      font-size: 24px;
      font-weight: 700;
      color: #D97706;
      margin-bottom: 4px;
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    .company-tagline {
      font-size: 9px;
      color: #71717A;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 8px;
    }

    .company-details {
      font-size: 8px;
      color: #52525B;
      line-height: 1.5;
    }

    .header-right {
      width: 180px;
      text-align: right;
    }

    .doc-title {
      font-size: 12px;
      font-weight: 700;
      color: #71717A;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 4px;
    }

    .doc-number {
      font-size: 16px;
      font-weight: 700;
      color: #F59E0B;
      margin-bottom: 8px;
    }

    .doc-meta {
      font-size: 8px;
      color: #71717A;
      line-height: 1.6;
    }

    /* Customer section */
    .section-title {
      font-size: 9px;
      font-weight: 700;
      color: #D97706;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 8px;
    }

    .customer-section {
      margin-bottom: 25px;
    }

    .customer-box {
      background: #FAFAFA;
      padding: 15px;
      border-left: 3px solid #F59E0B;
      border-radius: 4px;
    }

    .customer-name {
      font-size: 12px;
      font-weight: 700;
      color: #121212;
      margin-bottom: 6px;
    }

    .customer-detail {
      font-size: 9px;
      color: #52525B;
      line-height: 1.5;
    }

    /* Items table */
    .table-container {
      margin-bottom: 20px;
    }

    .table {
      width: 100%;
      border-collapse: collapse;
    }

    .table thead th {
      background: #121212;
      color: #fff;
      padding: 8px 10px;
      font-size: 8px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      text-align: left;
    }

    .table thead th:first-child {
      border-top-left-radius: 4px;
    }

    .table thead th:last-child {
      border-top-right-radius: 4px;
    }

    .table tbody tr {
      border-bottom: 1px solid #E4E4E7;
    }

    .row-even {
      background: #FAFAFA;
    }

    .cell {
      padding: 10px;
      font-size: 9px;
      color: #121212;
      vertical-align: top;
    }

    .cell-num {
      width: 30px;
      text-align: center;
    }

    .cell-desc {
      width: auto;
    }

    .cell-qty {
      width: 50px;
      text-align: right;
    }

    .cell-unit {
      width: 50px;
      text-align: right;
    }

    .cell-price {
      width: 80px;
      text-align: right;
    }

    .cell-total {
      width: 80px;
      text-align: right;
    }

    /* Totals section */
    .totals-section {
      margin-top: 10px;
      margin-left: auto;
      width: 250px;
    }

    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
    }

    .totals-label {
      font-size: 9px;
      color: #52525B;
    }

    .totals-value {
      font-size: 9px;
      color: #121212;
      text-align: right;
    }

    .totals-label.discount,
    .totals-value.discount {
      color: #6366F1;
    }

    .totals-label.tax,
    .totals-value.tax {
      color: #10B981;
    }

    .totals-divider {
      border-top: 1px solid #D4D4D8;
      margin-top: 8px;
      padding-top: 8px;
      margin-bottom: 4px;
    }

    .grand-total-label {
      font-size: 10px;
      font-weight: 700;
      color: #D97706;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .grand-total-value {
      font-size: 14px;
      font-weight: 700;
      color: #D97706;
      text-align: right;
    }

    /* Notes section */
    .notes-section {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px solid #E4E4E7;
    }

    .notes-content {
      font-size: 8px;
      color: #52525B;
      line-height: 1.6;
    }

    /* Footer */
    .footer {
      margin-top: 40px;
      padding-top: 15px;
      border-top: 1px solid #E4E4E7;
      text-align: center;
    }

    .footer-text {
      font-size: 8px;
      color: #A1A1AA;
    }

    .bank-details {
      margin-top: 8px;
      font-size: 7px;
      color: #71717A;
    }

    .thank-you {
      margin-top: 10px;
      font-size: 10px;
      font-weight: 700;
      color: #F59E0B;
      letter-spacing: 1px;
    }
  </style>
</head>
<body>
  <!-- Screen toolbar - hidden when printing -->
  <div class="screen-toolbar no-print">
    <span>${title} — ${quotation.quoteNumber}</span>
    <button class="btn-primary" onclick="window.print()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 6 2 18 2 18 9"></polyline>
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
        <rect x="6" y="14" width="12" height="8"></rect>
      </svg>
      Save as PDF / Print
    </button>
    <button class="btn-secondary" onclick="window.close()">
      Close
    </button>
  </div>

  <!-- Main print content -->
  <div class="print-area">
    <!-- Header -->
    <div class="header">
      <div class="header-left">
        ${logoHtml}
        <div class="company-name">${companyName}</div>
        <div class="company-tagline">${DEFAULT_TAGLINE}</div>
        <div class="company-details">
          ${companyAddress}<br />
          Phone: ${companyPhone} | Email: ${companyEmail}<br />
          Tax ID: ${companyTaxId}
        </div>
      </div>
      <div class="header-right">
        <div class="doc-title">${title}</div>
        <div class="doc-number">${quotation.quoteNumber}</div>
        <div class="doc-meta">
          Date: ${format(new Date(quotation.createdAt), 'MMM dd, yyyy')}${quotation.validUntil ? `<br />${validUntilLabel}: ${format(new Date(quotation.validUntil), 'MMM dd, yyyy')}` : ''}
        </div>
      </div>
    </div>

    <!-- Customer Section -->
    <div class="customer-section">
      <h2 class="section-title">Bill To</h2>
      <div class="customer-box">
        <div class="customer-name">${customer.name}</div>
        <div class="customer-detail">
          ${customer.phone}${customer.email ? ` | ${customer.email}` : ''}${customer.address ? `<br />${customer.address}${customer.city ? `, ${customer.city}` : ''}` : ''}
        </div>
      </div>
    </div>

    <!-- Items Table -->
    <div class="table-container">
      <table class="table">
        <thead>
          <tr>
            <th class="cell-num">#</th>
            <th class="cell-desc">Description</th>
            <th class="cell-qty">Qty</th>
            <th class="cell-unit">Cur.</th>
            <th class="cell-price">Unit Price</th>
            <th class="cell-total">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
    </div>

    <!-- Totals Section -->
    <div class="totals-section">
      <div class="totals-row">
        <span class="totals-label">Subtotal</span>
        <span class="totals-value">${formatMMK(Number(quotation.subtotal))}</span>
      </div>
      ${discountHtml}
      ${taxHtml}
      <div class="totals-row totals-divider">
        <span class="grand-total-label">Grand Total</span>
        <span class="grand-total-value">${formatMMK(Number(quotation.total))}</span>
      </div>
    </div>

    <!-- Notes Section -->
    ${notesHtml}

    <!-- Footer -->
    <div class="footer">
      <p class="footer-text">
        All prices are in Myanmar Kyat (MMK). Payment due within 30 days of invoice date.
      </p>
      <p class="bank-details">${formatBankDetails(companySettings)}</p>
      <p class="thank-you">Thank you for choosing ${companyName}</p>
    </div>
  </div>
</body>
</html>`;
}
