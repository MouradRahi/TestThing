import React from 'react'
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import type { ReportResult } from './types'

// Pure-JS PDF rendering (no headless browser) — serverless-safe on Vercel,
// per ROADMAP Part 4's explicit choice. Same renderer will serve Part 3.1
// invoices later; kept generic (columns/rows/summary) rather than
// report-type-specific so that reuse is just "pass a different ReportResult."
const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: 'Helvetica' },
  brand: { fontSize: 14, fontWeight: 700, marginBottom: 2 },
  title: { fontSize: 16, fontWeight: 700, marginTop: 10, marginBottom: 2 },
  subtitle: { fontSize: 9, color: '#666', marginBottom: 14 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  summaryItem: { marginRight: 20, marginBottom: 6, minWidth: 100 },
  summaryLabel: { fontSize: 7, color: '#666', textTransform: 'uppercase' },
  summaryValue: { fontSize: 12, fontWeight: 700 },
  headerRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#000', paddingVertical: 4 },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#ddd', paddingVertical: 4 },
  cell: { flex: 1, paddingHorizontal: 4 },
  cellRight: { flex: 1, paddingHorizontal: 4, textAlign: 'right' },
  headerCell: { flex: 1, paddingHorizontal: 4, fontWeight: 700 },
  headerCellRight: { flex: 1, paddingHorizontal: 4, fontWeight: 700, textAlign: 'right' },
  footer: { position: 'absolute', bottom: 20, left: 32, right: 32, fontSize: 7, color: '#999', textAlign: 'center' },
})

export async function reportToPdf(result: ReportResult, storeName: string): Promise<Buffer> {
  const doc = (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.brand}>{storeName}</Text>
        <Text style={styles.title}>{result.title}</Text>
        <Text style={styles.subtitle}>
          {result.subtitle ? `${result.subtitle} · ` : ''}
          Generated {new Date(result.generatedAt).toLocaleString('en-US')}
        </Text>

        {result.summary && result.summary.length > 0 && (
          <View style={styles.summaryRow}>
            {result.summary.map((s, i) => (
              <View key={i} style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>{s.label}</Text>
                <Text style={styles.summaryValue}>{s.value}</Text>
              </View>
            ))}
          </View>
        )}

        <View>
          <View style={styles.headerRow} fixed>
            {result.columns.map((c) => (
              <Text key={c.key} style={c.align === 'right' ? styles.headerCellRight : styles.headerCell}>
                {c.label}
              </Text>
            ))}
          </View>
          {result.rows.map((row, i) => (
            <View key={i} style={styles.row} wrap={false}>
              {result.columns.map((c) => (
                <Text key={c.key} style={c.align === 'right' ? styles.cellRight : styles.cell}>
                  {row[c.key] == null ? '' : String(row[c.key])}
                </Text>
              ))}
            </View>
          ))}
        </View>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  )
  return renderToBuffer(doc)
}
