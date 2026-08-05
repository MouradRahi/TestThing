import React from 'react'
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import { computeVatBreakdown } from '../vat'

// Invoice PDF (ROADMAP Part 3.1) — same pure-JS, serverless-safe renderer as
// the report engine's export-pdf.tsx (src/lib/reports/export-pdf.tsx), which
// is exactly why that one was built generic in the first place. This one is
// invoice-shaped rather than a columns/rows table: brand header, bill-to,
// line items, and a VAT-inclusive totals block.

export type InvoiceItem = {
  titleAtPurchase: string
  size?: string | null
  priceAtPurchase: number
  quantity: number
}

export type InvoiceData = {
  orderNumber: string
  createdAt: string
  customerName: string
  customerEmail?: string | null
  deliveryAddress: string
  area: string
  items: InvoiceItem[]
  subtotal: number
  deliveryFee: number
  discountAmount?: number
  discountCode?: string
  total: number
  storeName: string
  contactEmail?: string
  /** Omitted entirely when VAT is disabled — no VAT section is rendered. */
  vat?: { rate: number; registrationNumber?: string }
}

const money = (n: number) => `$${n.toFixed(2)}`

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: 'Helvetica' },
  brand: { fontSize: 16, fontWeight: 700 },
  invoiceLabel: { fontSize: 10, color: '#666', marginTop: 2 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  metaBlock: { alignItems: 'flex-end' },
  metaLine: { fontSize: 9, color: '#444' },
  sectionLabel: { fontSize: 7, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  billTo: { marginBottom: 20 },
  billToName: { fontSize: 10, fontWeight: 700 },
  billToLine: { fontSize: 9, color: '#444', marginTop: 1 },
  table: { marginBottom: 16 },
  tableHeaderRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#000', paddingVertical: 5 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#ddd', paddingVertical: 5 },
  colItem: { flex: 3, paddingHorizontal: 4 },
  colQty: { flex: 1, paddingHorizontal: 4, textAlign: 'right' },
  colPrice: { flex: 1, paddingHorizontal: 4, textAlign: 'right' },
  colTotal: { flex: 1, paddingHorizontal: 4, textAlign: 'right' },
  headerCell: { fontWeight: 700, fontSize: 8 },
  totalsBlock: { alignSelf: 'flex-end', width: 220, marginTop: 8 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  totalsRowFinal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 6,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#000',
  },
  totalsLabel: { fontSize: 9, color: '#444' },
  totalsValue: { fontSize: 9 },
  totalsFinalLabel: { fontSize: 10, fontWeight: 700 },
  totalsFinalValue: { fontSize: 10, fontWeight: 700 },
  vatNote: { fontSize: 8, color: '#666', marginTop: 10 },
  footer: { position: 'absolute', bottom: 24, left: 36, right: 36, fontSize: 7, color: '#999', textAlign: 'center' },
})

export async function generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
  const vatBreakdown = data.vat ? computeVatBreakdown(data.total, data.vat.rate) : null

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>{data.storeName}</Text>
            <Text style={styles.invoiceLabel}>INVOICE</Text>
            {data.vat?.registrationNumber && (
              <Text style={styles.invoiceLabel}>VAT Reg. No. {data.vat.registrationNumber}</Text>
            )}
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLine}>Order {data.orderNumber}</Text>
            <Text style={styles.metaLine}>{new Date(data.createdAt).toLocaleDateString('en-US')}</Text>
          </View>
        </View>

        <View style={styles.billTo}>
          <Text style={styles.sectionLabel}>Bill To</Text>
          <Text style={styles.billToName}>{data.customerName}</Text>
          {data.customerEmail && <Text style={styles.billToLine}>{data.customerEmail}</Text>}
          <Text style={styles.billToLine}>{data.area}</Text>
          <Text style={styles.billToLine}>{data.deliveryAddress}</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow} fixed>
            <Text style={[styles.colItem, styles.headerCell]}>Item</Text>
            <Text style={[styles.colQty, styles.headerCell]}>Qty</Text>
            <Text style={[styles.colPrice, styles.headerCell]}>Price</Text>
            <Text style={[styles.colTotal, styles.headerCell]}>Total</Text>
          </View>
          {data.items.map((item, i) => (
            <View key={i} style={styles.tableRow} wrap={false}>
              <Text style={styles.colItem}>
                {item.titleAtPurchase}
                {item.size ? ` (${item.size})` : ''}
              </Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colPrice}>{money(item.priceAtPurchase)}</Text>
              <Text style={styles.colTotal}>{money(item.priceAtPurchase * item.quantity)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text style={styles.totalsValue}>{money(data.subtotal)}</Text>
          </View>
          {!!data.discountAmount && data.discountAmount > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Discount{data.discountCode ? ` (${data.discountCode})` : ''}</Text>
              <Text style={styles.totalsValue}>-{money(data.discountAmount)}</Text>
            </View>
          )}
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Delivery</Text>
            <Text style={styles.totalsValue}>{money(data.deliveryFee)}</Text>
          </View>
          <View style={styles.totalsRowFinal}>
            <Text style={styles.totalsFinalLabel}>Total</Text>
            <Text style={styles.totalsFinalValue}>{money(data.total)}</Text>
          </View>
          {vatBreakdown && data.vat && (
            <>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>of which VAT ({data.vat.rate}%)</Text>
                <Text style={styles.totalsValue}>{money(vatBreakdown.vat)}</Text>
              </View>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Net (ex. VAT)</Text>
                <Text style={styles.totalsValue}>{money(vatBreakdown.net)}</Text>
              </View>
            </>
          )}
        </View>

        {vatBreakdown && (
          <Text style={styles.vatNote}>
            Prices shown are VAT-inclusive. VAT is calculated on the order total, not per line.
          </Text>
        )}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) => `${data.storeName} · Page ${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  )
  return renderToBuffer(doc)
}
