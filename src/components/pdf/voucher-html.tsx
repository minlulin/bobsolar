import { format } from "date-fns";
import type { ProjectVoucher } from "@/lib/db/schema";
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
  const companyName = companySettings["company_name"] ?? "BOB Solar";
  const companyAddress = companySettings["company_address"] ?? "";
  const companyPhone = companySettings["company_phone"] ?? "";
  const companyEmail = companySettings["company_email"] ?? "";

  const title =
    voucher.voucherType === "completion_certificate"
      ? "Completion Certificate"
      : "Final Payment Voucher";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${companyName} - ${title} ${voucher.voucherNumber}</title>
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
    @page { size: A4; margin: 20mm; }
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
    .print-area { max-width: 210mm; margin: 0 auto; padding: 60px 40px; }
    @media print {
      .screen-toolbar { display: none !important; }
      .print-area { padding: 0; }
    }
    .header {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 40px; border-bottom: 3px solid var(--primary); padding-bottom: 30px;
    }
    .brand-section { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
    .brand-name { font-size: 22px; font-weight: 900; letter-spacing: -1px; text-transform: uppercase; color: var(--primary); }
    .company-details { font-size: 8px; color: var(--slate); text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; }
    .doc-info { text-align: right; }
    .doc-type { font-size: 32px; font-weight: 900; color: #E2E8F0; text-transform: uppercase; line-height: 1; margin-bottom: 5px; }
    .doc-id { font-size: 14px; font-weight: 900; color: var(--accent); }
    .doc-date { font-size: 9px; color: var(--slate); font-weight: 700; }
    .client-section { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
    .section-label {
      font-size: 8px; font-weight: 900; color: var(--accent);
      text-transform: uppercase; letter-spacing: 2px; border-bottom: 1px solid var(--border);
      padding-bottom: 5px; margin-bottom: 10px;
    }
    .client-name { font-size: 16px; font-weight: 900; color: var(--primary); margin-bottom: 5px; }
    .client-meta { font-size: 9px; color: var(--slate); font-weight: 500; }
    .voucher-details { margin-bottom: 50px; }
    .voucher-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }
    .voucher-card {
      background: #F8FAFC; border-radius: 12px; padding: 24px;
      border: 1px solid var(--border); text-align: center;
    }
    .voucher-card-label {
      font-size: 8px; font-weight: 900; color: var(--slate);
      text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;
    }
    .voucher-card-value {
      font-size: 24px; font-weight: 900; color: var(--primary); letter-spacing: -0.5px;
    }
    .voucher-card-value.balance { color: #D97706; }
    .voucher-card-value.positive { color: #059669; }
    .info-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    .info-table td { padding: 10px 0; border-bottom: 1px solid var(--border); }
    .info-table td:first-child { font-size: 8px; font-weight: 900; color: var(--slate); text-transform: uppercase; letter-spacing: 1px; width: 180px; }
    .info-table td:last-child { font-size: 11px; font-weight: 700; color: var(--primary); }
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
    .notes-section { margin-top: 40px; }
    .notes-title { font-size: 9px; font-weight: 900; text-transform: uppercase; color: var(--accent); margin-bottom: 10px; }
    .notes-content { font-size: 9px; color: var(--slate); line-height: 1.8; }
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
          <span class="brand-name">${companyName}</span>
        </div>
        <div class="company-details">
          Solar Energy Solutions<br/>
          ${companyAddress}<br/>
          ${companyPhone} • ${companyEmail}
        </div>
      </div>
      <div class="doc-info">
        <div class="doc-type">${title}</div>
        <div class="doc-id">${voucher.voucherNumber}</div>
        <div class="doc-date">Issued ${format(new Date(voucher.issuedAt), "MMMM dd, yyyy")}</div>
      </div>
    </div>

    <div class="client-section">
      <div>
        <div class="section-label">Issued To</div>
        <div class="client-name">${voucher.customerName}</div>
        <div class="client-meta">
          Project ${voucher.projectNumber}
          ${customerAddress ? `<br/>${customerAddress}` : ""}
        </div>
      </div>
      <div>
        <div class="section-label">Document Reference</div>
        <div class="client-meta">
          <strong>Voucher:</strong> ${voucher.voucherNumber}<br/>
          <strong>Project:</strong> ${voucher.projectNumber}<br/>
          <strong>Currency:</strong> Myanmar Kyat (MMK)
        </div>
      </div>
    </div>

    <div class="voucher-details">
      <table class="info-table">
        <tr>
          <td>Total Project Amount</td>
          <td>${formatMMK(Number(voucher.totalAmount))}</td>
        </tr>
        <tr>
          <td>Amount Paid</td>
          <td style="color: #059669;">${formatMMK(Number(voucher.paidAmount))}</td>
        </tr>
        <tr>
          <td>Outstanding Balance</td>
          <td style="color: ${Number(voucher.balanceAmount) > 0 ? "#D97706" : "#059669"}; font-size: 14px;">
            ${formatMMK(Number(voucher.balanceAmount))}
          </td>
        </tr>
      </table>
    </div>

    ${
      voucher.notes
        ? `
    <div class="notes-section">
      <div class="notes-title">Remarks</div>
      <p class="notes-content">${voucher.notes}</p>
    </div>`
        : ""
    }

    <div class="signature-section">
      <div class="sig-box">
        <div class="sig-label">Customer Acknowledgement</div>
      </div>
      <div class="sig-box">
        <div class="sig-label">Authorized Signatory</div>
      </div>
    </div>

    <div class="footer">
      This is a system-generated document for project handover and payment reconciliation.<br/>
      Generated by BOB Solar Infrastructure System • Yangon, Myanmar
    </div>
  </div>
</body>
</html>`;
}
