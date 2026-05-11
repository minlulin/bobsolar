import { Document, Page, Text, View, Font, Image } from '@react-pdf/renderer';
import { formatMMK } from '@/lib/utils';
import { pdfStyles } from './pdf-styles';
import { format } from 'date-fns';
import type { Quotation, QuotationItem, Customer } from '@/lib/db/schema';
import {
  COMPANY_SETTING_KEYS,
  COMPANY_SETTING_DEFAULTS,
  formatBankDetails,
} from '@/lib/domain/settings-keys';
import path from 'path';

// Register Inter font using local bundled fonts
Font.register({
  family: 'Inter',
  fonts: [
    {
      src: path.join(process.cwd(), 'public/fonts/inter-regular.woff2'),
      fontWeight: 400,
    },
    {
      src: path.join(process.cwd(), 'public/fonts/inter-semibold.woff2'),
      fontWeight: 600,
    },
    {
      src: path.join(process.cwd(), 'public/fonts/inter-bold.woff2'),
      fontWeight: 700,
    },
  ],
});

const DEFAULT_TAGLINE = 'Powering Tomorrow with Solar Energy';

interface QuoteDocumentProps {
  quotation: Quotation & { items: QuotationItem[]; customer: Customer };
  companyLogoUrl?: string | null;
  companySettings?: Record<string, string>;
}

export function QuoteDocument({
  quotation,
  companyLogoUrl,
  companySettings = {},
}: QuoteDocumentProps): React.JSX.Element {
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

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        {/* Header */}
        <View style={pdfStyles.header}>
          <View style={pdfStyles.headerLeft}>
            {companyLogoUrl ? (
              <>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image */}
                <Image src={companyLogoUrl} style={pdfStyles.companyLogo} />
              </>
            ) : null}
            <Text style={pdfStyles.companyName}>{companyName}</Text>
            <Text style={pdfStyles.companyTagline}>{DEFAULT_TAGLINE}</Text>
            <Text style={pdfStyles.companyDetails}>
              {companyAddress}
              {'\n'}
              Phone: {companyPhone} | Email: {companyEmail}
              {'\n'}
              Tax ID: {companyTaxId}
            </Text>
          </View>

          <View style={pdfStyles.headerRight}>
            <Text style={pdfStyles.quoteTitle}>QUOTATION</Text>
            <Text style={pdfStyles.quoteNumber}>{quotation.quoteNumber}</Text>
            <Text style={pdfStyles.quoteMeta}>
              Date: {format(new Date(quotation.createdAt), 'MMM dd, yyyy')}
              {quotation.validUntil && (
                <>
                  {'\n'}
                  Valid Until:{' '}
                  {format(new Date(quotation.validUntil), 'MMM dd, yyyy')}
                </>
              )}
            </Text>
          </View>
        </View>

        {/* Customer Section */}
        <View style={pdfStyles.customerSection}>
          <Text style={pdfStyles.sectionTitle}>Bill To</Text>
          <View style={pdfStyles.customerBox}>
            <Text style={pdfStyles.customerName}>{customer.name}</Text>
            <Text style={pdfStyles.customerDetail}>
              {customer.phone}
              {customer.email && (
                <>
                  {' | '}
                  {customer.email}
                </>
              )}
              {customer.address && (
                <>
                  {'\n'}
                  {customer.address}
                  {customer.city && `, ${customer.city}`}
                </>
              )}
            </Text>
          </View>
        </View>

        {/* Items Table */}
        <View style={pdfStyles.table}>
          {/* Table Header */}
          <View style={pdfStyles.tableHeader}>
            <Text style={[pdfStyles.tableHeaderCell, pdfStyles.colNum]}>#</Text>
            <Text style={[pdfStyles.tableHeaderCell, pdfStyles.colDescription]}>
              Description
            </Text>
            <Text style={[pdfStyles.tableHeaderCell, pdfStyles.colQty]}>
              Qty
            </Text>
            <Text style={[pdfStyles.tableHeaderCell, pdfStyles.colUnit]}>
              Cur.
            </Text>
            <Text style={[pdfStyles.tableHeaderCell, pdfStyles.colPrice]}>
              Unit Price
            </Text>
            <Text style={[pdfStyles.tableHeaderCell, pdfStyles.colTotal]}>
              Total
            </Text>
          </View>

          {/* Table Rows */}
          {items.map((item, index) => (
            <View
              key={item.id}
              style={
                index % 2 === 0 ? pdfStyles.tableRow : pdfStyles.tableRowAlt
              }
            >
              <Text style={[pdfStyles.tableCell, pdfStyles.colNum]}>
                {index + 1}
              </Text>
              <Text style={[pdfStyles.tableCell, pdfStyles.colDescription]}>
                {item.description}
              </Text>
              <Text style={[pdfStyles.tableCellRight, pdfStyles.colQty]}>
                {Number(item.quantity).toFixed(2)}
              </Text>
              <Text style={[pdfStyles.tableCellRight, pdfStyles.colUnit]}>
                MMK
              </Text>
              <Text style={[pdfStyles.tableCellRight, pdfStyles.colPrice]}>
                {formatMMK(Number(item.unitPrice))}
              </Text>
              <Text style={[pdfStyles.tableCellRight, pdfStyles.colTotal]}>
                {formatMMK(Number(item.totalPrice))}
              </Text>
            </View>
          ))}
        </View>

        {/* Totals Section */}
        <View style={pdfStyles.totalsSection}>
          <View style={pdfStyles.totalsRow}>
            <Text style={pdfStyles.totalsLabel}>Subtotal</Text>
            <Text style={pdfStyles.totalsValue}>
              {formatMMK(Number(quotation.subtotal))}
            </Text>
          </View>

          {Number(quotation.discountPercent) > 0 && (
            <View style={pdfStyles.totalsRow}>
              <Text style={[pdfStyles.totalsLabel, pdfStyles.totalsDiscount]}>
                Discount ({quotation.discountPercent}%)
              </Text>
              <Text style={[pdfStyles.totalsValue, pdfStyles.totalsDiscount]}>
                -{formatMMK(Number(quotation.discountAmount))}
              </Text>
            </View>
          )}

          {Number(quotation.taxPercent) > 0 && (
            <View style={pdfStyles.totalsRow}>
              <Text style={[pdfStyles.totalsLabel, pdfStyles.totalsTax]}>
                Commercial Tax ({quotation.taxPercent}%)
              </Text>
              <Text style={[pdfStyles.totalsValue, pdfStyles.totalsTax]}>
                +{formatMMK(Number(quotation.taxAmount))}
              </Text>
            </View>
          )}

          <View style={[pdfStyles.totalsRow, pdfStyles.totalsDivider]}>
            <Text style={pdfStyles.grandTotalLabel}>Grand Total</Text>
            <Text style={pdfStyles.grandTotalValue}>
              {formatMMK(Number(quotation.total))}
            </Text>
          </View>
        </View>

        {/* Notes Section */}
        {quotation.notes && (
          <View style={pdfStyles.notesSection}>
            <Text style={pdfStyles.sectionTitle}>Notes & Terms</Text>
            <Text style={pdfStyles.notesContent}>{quotation.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={pdfStyles.footer}>
          <Text style={pdfStyles.footerText}>
            All prices are in Myanmar Kyat (MMK). Payment due within 30 days of
            invoice date.
          </Text>
          <Text style={pdfStyles.bankDetails}>
            {formatBankDetails(companySettings)}
          </Text>
          <Text style={pdfStyles.thankYou}>
            Thank you for choosing {companyName}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
