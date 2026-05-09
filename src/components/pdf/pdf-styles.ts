/**
 * PDF Styles for BOB Solar Quotation Documents
 * Uses @react-pdf/renderer StyleSheet API
 */

import { StyleSheet } from '@react-pdf/renderer';

// Solar Flow color palette for PDF
export const colors = {
  // Primary accent - Solar Amber
  amber: '#F59E0B',
  amberDark: '#D97706',
  // Secondary accent - Energy Emerald
  emerald: '#10B981',
  // Tertiary accent - Flow Indigo
  indigo: '#6366F1',
  // Neutrals
  dark: '#121212',
  darkSecondary: '#1E1E1E',
  darkTertiary: '#2A2A2A',
  white: '#FFFFFF',
  gray: {
    50: '#FAFAFA',
    100: '#F4F4F5',
    200: '#E4E4E7',
    300: '#D4D4D8',
    400: '#A1A1AA',
    500: '#71717A',
    600: '#52525B',
    700: '#3F3F46',
    800: '#27272A',
    900: '#18181B',
  },
};

// Create reusable styles
export const pdfStyles = StyleSheet.create({
  // Page container
  page: {
    backgroundColor: colors.white,
    padding: 40,
    fontFamily: 'Inter',
    fontSize: 10,
    color: colors.dark,
  },

  // Header section
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: colors.amber,
  },

  headerLeft: {
    flex: 1,
  },

  companyLogo: {
    width: 72,
    maxHeight: 72,
    objectFit: 'contain',
    marginBottom: 10,
  },

  companyName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.amberDark,
    marginBottom: 4,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  companyTagline: {
    fontSize: 9,
    color: colors.gray[500],
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },

  companyDetails: {
    fontSize: 8,
    color: colors.gray[600],
    lineHeight: 1.5,
  },

  headerRight: {
    width: 180,
    alignItems: 'flex-end',
  },

  quoteTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 4,
  },

  quoteNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.amber,
    marginBottom: 8,
  },

  quoteMeta: {
    fontSize: 8,
    color: colors.gray[500],
    lineHeight: 1.6,
    textAlign: 'right',
  },

  // Customer section
  sectionTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.amberDark,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 8,
  },

  customerSection: {
    marginBottom: 25,
  },

  customerBox: {
    backgroundColor: colors.gray[50],
    padding: 15,
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: colors.amber,
  },

  customerName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.dark,
    marginBottom: 6,
  },

  customerDetail: {
    fontSize: 9,
    color: colors.gray[600],
    lineHeight: 1.5,
  },

  // Items table
  table: {
    marginBottom: 20,
  },

  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.dark,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },

  tableHeaderCell: {
    color: colors.white,
    fontSize: 8,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },

  tableRowAlt: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
    backgroundColor: colors.gray[50],
  },

  tableCell: {
    fontSize: 9,
    color: colors.dark,
  },

  tableCellRight: {
    fontSize: 9,
    color: colors.dark,
    textAlign: 'right',
  },

  // Column widths
  colNum: { width: 30 },
  colDescription: { width: 200 },
  colQty: { width: 50 },
  colUnit: { width: 50 },
  colPrice: { width: 80 },
  colTotal: { width: 80 },

  // Totals section
  totalsSection: {
    marginTop: 10,
    marginLeft: 'auto',
    width: 250,
  },

  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },

  totalsLabel: {
    fontSize: 9,
    color: colors.gray[600],
  },

  totalsValue: {
    fontSize: 9,
    color: colors.dark,
    textAlign: 'right',
  },

  totalsDiscount: {
    color: colors.indigo,
  },

  totalsTax: {
    color: colors.emerald,
  },

  totalsDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.gray[300],
    marginTop: 8,
    paddingTop: 8,
    marginBottom: 4,
  },

  grandTotalLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.amberDark,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  grandTotalValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.amberDark,
    textAlign: 'right',
  },

  // Notes section
  notesSection: {
    marginTop: 30,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
  },

  notesContent: {
    fontSize: 8,
    color: colors.gray[600],
    lineHeight: 1.6,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
  },

  footerText: {
    fontSize: 8,
    color: colors.gray[400],
    textAlign: 'center',
  },

  bankDetails: {
    marginTop: 8,
    fontSize: 7,
    color: colors.gray[500],
    textAlign: 'center',
  },

  thankYou: {
    marginTop: 10,
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.amber,
    textAlign: 'center',
    letterSpacing: 1,
  },

  // Status badge styles
  statusDraft: {
    backgroundColor: colors.gray[200],
    color: colors.gray[600],
  },

  statusSent: {
    backgroundColor: colors.indigo + '20',
    color: colors.indigo,
  },

  statusAccepted: {
    backgroundColor: colors.emerald + '20',
    color: colors.emerald,
  },

  statusRejected: {
    backgroundColor: '#EF444420',
    color: '#EF4444',
  },
});
