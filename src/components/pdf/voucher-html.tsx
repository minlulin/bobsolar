import { format } from "date-fns";
import type { ProjectVoucher } from "@/lib/db/schema";
import { COMPANY_SETTING_KEYS } from "@/lib/domain/settings-keys";
import { formatMMK } from "@/lib/utils";

interface VoucherHtmlInput {
  voucher: ProjectVoucher & { projectNumber: string; customerName: string };
  customerAddress?: string | null;
  companySettings?: Record<string, string>;
}

export function VoucherHtml({
  voucher,
  customerAddress,
  companySettings = {},
}: VoucherHtmlInput): string {
  const companyName = companySettings[COMPANY_SETTING_KEYS.NAME] ?? "BOB Solar";
  const companyAddress = companySettings[COMPANY_SETTING_KEYS.ADDRESS] ?? "";
  const companyPhone = companySettings[COMPANY_SETTING_KEYS.PHONE] ?? "";
  const companyEmail = companySettings[COMPANY_SETTING_KEYS.EMAIL] ?? "";
  const companyLogoUrl = companySettings[COMPANY_SETTING_KEYS.LOGO_URL] ?? null;

  const isCompletion = voucher.voucherType === "completion_certificate";
  const title = isCompletion ? "COMPLETION CERTIFICATE" : "PAYMENT VOUCHER";

  const accent = "#F59E0B";
  const accentDark = "#D97706";
  const primary = "#0F172A";
  const slate = "#64748B";
  const light = "#F8FAFC";
  const border = "#E2E8F0";
  const balanceAmt = Number(voucher.balanceAmount);
  const balanceColor = balanceAmt > 0 ? accentDark : "#059669";
  const paidColor = "#059669";

  const progressPct = Math.min(
    100,
    Math.round((Number(voucher.paidAmount) / Math.max(Number(voucher.totalAmount), 1)) * 100),
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${companyName} - ${title} ${voucher.voucherNumber}</title>
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
    .page-wrapper { padding: 70px 0 30px; }

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
    .doc-body { padding: 20px 24px 24px; }

    /* HEADER */
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 14px;
      padding-bottom: 14px;
      border-bottom: 1px solid ${border};
    }
    .brand-col { display: flex; align-items: flex-start; gap: 10px; }
    .brand-logo { height: 40px; width: auto; object-fit: contain; }
    .logo-placeholder {
      background: ${primary}; color: white;
      width: 40px; height: 40px; border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      font-weight: 900; font-size: 14px; flex-shrink: 0;
    }
    .brand-name { font-size: 14px; font-weight: 700; color: ${primary}; margin-bottom: 3px; line-height: 1.2; }
    .brand-meta { font-size: 9px; color: ${slate}; line-height: 1.6; }

    .doc-col { text-align: right; }
    .doc-title {
      font-size: 20px; font-weight: 900; color: ${primary};
      text-transform: uppercase; letter-spacing: 0.5px; line-height: 1; margin-bottom: 10px;
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

    /* CUSTOMER STRIP */
    .customer-strip {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: ${light};
      border: 1px solid ${border};
      border-left: 3px solid ${accent};
      border-radius: 5px;
      padding: 10px 14px;
      margin-bottom: 20px;
    }
    .customer-label { font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: ${slate}; margin-bottom: 2px; }
    .customer-name { font-size: 13px; font-weight: 700; color: ${primary}; }
    .customer-meta { font-size: 9.5px; color: ${slate}; margin-top: 2px; }

    /* STATUS BADGE */
    .status-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    /* AMOUNT CARDS */
    .amount-cards {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }
    .amount-card {
      background: white;
      border: 1px solid ${border};
      border-radius: 8px;
      padding: 14px 16px;
    }
    .amount-card-label {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.7px;
      color: ${slate};
      margin-bottom: 6px;
    }
    .amount-card-value {
      font-size: 15px;
      font-weight: 900;
      line-height: 1;
    }
    .amount-card-sub {
      font-size: 9px;
      color: ${slate};
      margin-top: 4px;
    }

    /* PROGRESS BAR */
    .progress-section {
      margin-bottom: 20px;
      background: ${light};
      border: 1px solid ${border};
      border-radius: 8px;
      padding: 14px 16px;
    }
    .progress-header {
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: ${slate};
      margin-bottom: 8px;
    }
    .progress-bar-bg {
      width: 100%;
      height: 8px;
      background: ${border};
      border-radius: 4px;
      overflow: hidden;
    }
    .progress-bar-fill {
      height: 100%;
      border-radius: 4px;
      background: linear-gradient(90deg, ${accent}, ${paidColor});
      width: ${progressPct}%;
    }

    /* DETAIL TABLE */
    .detail-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid ${border};
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 20px;
    }
    .detail-table tr:last-child td { border-bottom: none; }
    .detail-table td {
      padding: 12px 16px;
      border-bottom: 1px solid ${border};
      font-size: 11px;
    }
    .detail-table td:first-child {
      font-weight: 700;
      color: ${slate};
      text-transform: uppercase;
      font-size: 9.5px;
      letter-spacing: 0.5px;
      background: ${light};
      width: 220px;
      border-right: 1px solid ${border};
    }
    .detail-table td:last-child {
      font-weight: 700;
      color: ${primary};
      text-align: right;
    }

    /* NOTES */
    .notes-box {
      background: ${light};
      border: 1px solid ${border};
      border-radius: 6px;
      padding: 12px 16px;
      margin-bottom: 20px;
    }
    .notes-label {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: ${accent};
      margin-bottom: 6px;
    }
    .notes-content { font-size: 10px; color: ${slate}; line-height: 1.6; }

    /* SIGNATURES */
    .signature-row {
      display: flex;
      justify-content: space-between;
      margin-top: 32px;
      page-break-inside: avoid;
    }
    .sig-box {
      width: 42%;
      border-top: 1px solid ${primary};
      padding-top: 6px;
      text-align: center;
    }
    .sig-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: ${slate}; }

    /* FOOTER */
    .doc-footer {
      margin-top: 20px;
      padding-top: 10px;
      border-top: 1px solid ${border};
      text-align: center;
      font-size: 8.5px;
      color: #9CA3AF;
    }

    /* PRINT */
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
            <div>
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
              <span class="meta-label">Voucher No.</span>
              <span class="meta-value">${voucher.voucherNumber}</span>
              <span class="meta-label">Issue Date</span>
              <span class="meta-value">${format(new Date(voucher.issuedAt), "dd MMM yyyy")}</span>
              <span class="meta-label">Project Ref</span>
              <span class="meta-value">${voucher.projectNumber}</span>
            </div>
          </div>
        </div>

        <!-- CUSTOMER STRIP -->
        <div class="customer-strip">
          <div>
            <div class="customer-label">Issued To</div>
            <div class="customer-name">${voucher.customerName}</div>
            ${customerAddress ? `<div class="customer-meta">${customerAddress}</div>` : ""}
          </div>
          <div style="text-align:right;">
            <div class="customer-label" style="margin-bottom:4px;">Payment Status</div>
            <span class="status-badge" style="background:${balanceAmt === 0 ? "#D1FAE5" : "#FEF3C7"};color:${balanceAmt === 0 ? "#065F46" : "#92400E"};">
              ${balanceAmt === 0 ? "&#10003; Fully Paid" : "Partial Payment"}
            </span>
          </div>
        </div>

        <!-- AMOUNT CARDS -->
        <div class="amount-cards">
          <div class="amount-card" style="border-top:3px solid ${primary};">
            <div class="amount-card-label">Total Project Amount</div>
            <div class="amount-card-value" style="color:${primary};">${formatMMK(Number(voucher.totalAmount))}</div>
            <div class="amount-card-sub">Full contract value</div>
          </div>
          <div class="amount-card" style="border-top:3px solid ${paidColor};">
            <div class="amount-card-label">Amount Paid</div>
            <div class="amount-card-value" style="color:${paidColor};">${formatMMK(Number(voucher.paidAmount))}</div>
            <div class="amount-card-sub">Received to date</div>
          </div>
          <div class="amount-card" style="border-top:3px solid ${balanceColor};">
            <div class="amount-card-label">Outstanding Balance</div>
            <div class="amount-card-value" style="color:${balanceColor};">${formatMMK(balanceAmt)}</div>
            <div class="amount-card-sub">${balanceAmt === 0 ? "No balance due" : "Remaining to collect"}</div>
          </div>
        </div>

        <!-- PAYMENT PROGRESS -->
        <div class="progress-section">
          <div class="progress-header">
            <span>Payment Progress</span>
            <span style="color:${paidColor};">${progressPct}% Paid</span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill"></div>
          </div>
        </div>

        <!-- DETAIL TABLE -->
        <table class="detail-table">
          <tr>
            <td>Voucher Type</td>
            <td>${isCompletion ? "Completion Certificate" : "Payment Voucher"}</td>
          </tr>
          <tr>
            <td>Total Project Amount</td>
            <td>${formatMMK(Number(voucher.totalAmount))}</td>
          </tr>
          <tr>
            <td>Amount Paid</td>
            <td style="color:${paidColor};">${formatMMK(Number(voucher.paidAmount))}</td>
          </tr>
          <tr>
            <td>Outstanding Balance</td>
            <td style="color:${balanceColor};font-size:14px;">${formatMMK(balanceAmt)}</td>
          </tr>
        </table>

        ${
          voucher.notes
            ? `<div class="notes-box">
            <div class="notes-label">Remarks</div>
            <div class="notes-content">${voucher.notes.replace(/\n/g, "<br/>")}</div>
          </div>`
            : ""
        }

        <!-- SIGNATURES -->
        <div class="signature-row">
          <div class="sig-box">
            <div class="sig-label">Customer Acknowledgement</div>
          </div>
          <div class="sig-box">
            <div class="sig-label">Authorized Signatory</div>
          </div>
        </div>

        <!-- FOOTER -->
        <div class="doc-footer">
          System-generated document for project payment reconciliation &bull;
          BOB Solar Infrastructure System &bull; Myanmar
        </div>

      </div>
    </div>
  </div>
</body>
</html>`;
}
