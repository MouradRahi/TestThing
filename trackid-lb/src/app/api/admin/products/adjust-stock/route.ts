import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from '@/lib/payload'
import { requireAdminUser } from '@/lib/payments/admin-guard'
import { logAuditEvent } from '@/lib/audit-log'
import { safeRevalidatePath } from '@/lib/revalidate'
import { getSizes } from '@/lib/stock'

// Stock-adjustment admin action (ROADMAP Part 3.3) — a manual +/- with a
// reason, so "why is stock wrong" is answerable later without guessing.
// Movement history is the AuditLog entry this writes (before → after,
// reason, who) — a dedicated StockMovements collection would duplicate what
// AuditLog already does for every other admin-driven change in this app.
const REASONS = ['received', 'damaged', 'correction', 'other'] as const

export async function POST(req: NextRequest) {
  const payload = await getPayload()
  const admin = await requireAdminUser(payload, req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const productId = Number(body.productId)
  const size = typeof body.size === 'string' && body.size ? body.size : null
  const delta = Number(body.delta)
  const reason = typeof body.reason === 'string' ? body.reason : ''

  if (!Number.isInteger(productId)) return NextResponse.json({ error: 'Invalid product' }, { status: 400 })
  if (!Number.isInteger(delta) || delta === 0) return NextResponse.json({ error: 'Enter a non-zero whole number' }, { status: 400 })
  if (!REASONS.includes(reason as (typeof REASONS)[number])) {
    return NextResponse.json({ error: 'Invalid reason' }, { status: 400 })
  }

  const product = await payload.findByID({ collection: 'products', id: productId, depth: 0 }).catch(() => null)
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  const sizes = getSizes(product)
  let before: number
  let after: number
  let updateData: Record<string, unknown>

  if (sizes.length > 0) {
    if (!size) return NextResponse.json({ error: 'This product has sizes — pick one' }, { status: 400 })
    const rows = Array.isArray(product.sizes) ? [...product.sizes] : []
    const idx = rows.findIndex((s: { label?: string }) => s?.label === size)
    if (idx < 0) return NextResponse.json({ error: `Unknown size "${size}"` }, { status: 400 })
    before = rows[idx].stockQuantity ?? 0
    after = Math.max(0, before + delta)
    rows[idx] = { ...rows[idx], stockQuantity: after }
    updateData = { sizes: rows }
  } else {
    before = typeof product.stockQuantity === 'number' ? product.stockQuantity : 0
    after = Math.max(0, before + delta)
    updateData = { stockQuantity: after }
  }

  await payload.update({ collection: 'products', id: productId, data: updateData })

  await logAuditEvent(payload, {
    collectionSlug: 'products',
    documentId: String(productId),
    action: 'update',
    req: { user: admin.user },
    summary: `Stock adjusted for "${product.title ?? productId}"${size ? ` (${size})` : ''}: ${before} → ${after} (${delta > 0 ? '+' : ''}${delta}, ${reason})`,
    changedFields: [{ field: 'stock', size, before, after, delta, reason }],
  })

  safeRevalidatePath('/shop')
  if (product.slug) safeRevalidatePath(`/product/${product.slug}`)

  return NextResponse.json({ ok: true, before, after })
}
