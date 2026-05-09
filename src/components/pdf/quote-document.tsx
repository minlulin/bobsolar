'use client';

import { Document, Page, Text, View, Font } from '@react-pdf/renderer';
import { formatMMK } from '@/lib/pricing/engine';
import { pdfStyles } from './pdf-styles';
import { format } from 'date-fns';
import type { Quotation, QuotationItem, Customer } from '@/lib/db/schema';

// Register Inter font (using default system fonts as fallback)
// Note: For production, you'd register actual font files
Font.register({
  family: 'Inter',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2',
      fontWeight: 400,
    },
    {
      src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hiJ-Ek-_EeA.woff2',
      fontWeight: 600,
    },
    {
      src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYAZ9hiJ-Ek-_EeA.woff2',
      fontWeight: 700,
    },
  ],
});

// Company info (could be fetched from settings in production)
const COMPANY_INFO = {
  name: 'BOB Solar',
  tagline: 'Powering Tomorrow with Solar Energy',
  address: '123 Solar Street, Yangon, Myanmar',
  phone: '+95 9 123 456 789',
  email: 'info@bobsolar.com',
  taxId: 'TIN-2026-XXXXX',
};

const BANK_DETAILS = `
KBZ Bank | A/C: 123-456-789-0 | Name: BOB Solar Co., Ltd.
AYA Bank | A/C: 987-654-321-0 | Name: BOB Solar Co., Ltd.
`;

interface QuoteDocumentProps {
  quotation: Quotation & { items: QuotationItem[]; customer: Customer };
}

export function QuoteDocument({ quotation }: QuoteDocumentProps) {
  const { customer, items } = quotation;

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        {/* Header */}
        <View style={pdfStyles.header}>
          <View style={pdfStyles.headerLeft}>
            <Text style={pdfStyles.companyName}>{COMPANY_INFO.name}</Text>
            <Text style={pdfStyles.companyTagline}>{COMPANY_INFO.tagline}</Text>
            <Text style={pdfStyles.companyDetails}>
              {COMPANY_INFO.address}
              {'\n'}
              Phone: {COMPANY_INFO.phone} | Email: {COMPANY_INFO.email}
              {'\n'}
              Tax ID: {COMPANY_INFO.taxId}
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
              Unit
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
          <Text style={pdfStyles.bankDetails}>{BANK_DETAILS}</Text>
          <Text style={pdfStyles.thankYou}>
            Thank you for choosing BOB Solar
          </Text>
        </View>
      </Page>
    </Document>
  );
}
