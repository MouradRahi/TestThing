import type { PgPool } from '../db-pool'
import type { ReportParams, ReportResult } from './types'
import { resolveDateRange, money } from './params'

type Row = { [k: string]: unknown }

const LOW_STOCK_THRESHOLD = 3

// Current stock value, low/dead stock, and sell-through over the selected
// range. Stock itself is "right now" (published catalog); the date range
// only scopes the "units sold" side of the sell-through calculation — mirrors
// how src/lib/stock.ts already treats sized vs. flat stock, done here as one
// SQL pass instead of per-product Local API calls (Part 4's whole point).
export async function buildInventoryReport(pool: PgPool, params: ReportParams): Promise<ReportResult> {
  const { from, to } = resolveDateRange(params)
  const locale = params.locale || 'en'

  const [{ rows: stockRows }, { rows: soldRows }] = await Promise.all([
    pool.query(
      `select p.id::text as product_id,
              coalesce(pl.title, 'Untitled') as title,
              p.price::numeric as price,
              case
                when exists (select 1 from products_sizes ps where ps._parent_id = p.id)
                  then coalesce((select sum(ps.stock_quantity) from products_sizes ps where ps._parent_id = p.id), 0)
                else p.stock_quantity
              end::numeric as stock
       from products p
       left join products_locales pl on pl._parent_id = p.id and pl._locale = $1
       where p.status = 'published'`,
      [locale],
    ),
    pool.query(
      `select oi.product_id as product_id, sum(oi.quantity)::int as sold
       from orders_items oi
       join orders o on o.id = oi._parent_id
       where o.order_status <> 'cancelled' and o.created_at >= $1 and o.created_at <= $2
       group by oi.product_id`,
      [from.toISOString(), to.toISOString()],
    ),
  ])

  const soldByProduct = new Map<string, number>()
  for (const r of soldRows as Row[]) soldByProduct.set(String(r.product_id), Number(r.sold) || 0)

  let totalStockValue = 0
  let lowStockCount = 0
  let deadStockCount = 0

  const rows = (stockRows as Row[])
    .map((r) => {
      const stock = Number(r.stock) || 0
      const price = Number(r.price) || 0
      const sold = soldByProduct.get(String(r.product_id)) ?? 0
      const stockValue = stock * price
      const sellThrough = stock + sold > 0 ? sold / (stock + sold) : null
      totalStockValue += stockValue
      if (stock <= LOW_STOCK_THRESHOLD) lowStockCount += 1
      if (sold === 0 && stock > 0) deadStockCount += 1
      return {
        title: String(r.title),
        stock,
        stockValue: money(stockValue),
        sold,
        sellThrough: sellThrough == null ? '—' : `${Math.round(sellThrough * 100)}%`,
        _sortStock: stock,
      }
    })
    .sort((a, b) => a._sortStock - b._sortStock)
    .map(({ _sortStock, ...rest }) => rest)

  return {
    title: 'Inventory',
    subtitle: 'Stock as of now · sales scoped to the selected range',
    generatedAt: new Date().toISOString(),
    columns: [
      { key: 'title', label: 'Product' },
      { key: 'stock', label: 'Stock', align: 'right' },
      { key: 'stockValue', label: 'Stock value', align: 'right' },
      { key: 'sold', label: 'Sold (range)', align: 'right' },
      { key: 'sellThrough', label: 'Sell-through', align: 'right' },
    ],
    rows,
    summary: [
      { label: 'Total stock value', value: money(totalStockValue) },
      { label: 'Low stock (≤3)', value: String(lowStockCount) },
      { label: 'Dead stock (0 sold, in stock)', value: String(deadStockCount) },
      { label: 'Products', value: String(rows.length) },
    ],
  }
}
