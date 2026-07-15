import type Stripe from 'stripe'
import type { Interval, TaxBehavior } from '../config/types'
import { FEATURE_PREFIX, META_KEY } from '../stripe/tags'

export interface PullResult {
  source: string
  productCount: number
  priceCount: number
  /** Non-fatal notes about catalog items that couldn't be represented. */
  warnings: string[]
}

interface PulledPrice {
  key: string
  amount: number
  currency: string
  interval: Interval | null
  intervalCount: number
  nickname: string | null
  taxBehavior: TaxBehavior | null
}
interface PulledProduct {
  key: string
  name: string
  description: string | null
  features: Record<string, string>
  prices: PulledPrice[]
}

/**
 * Read the active catalog from a Stripe account and emit `stripe.config.ts`
 * source. Read-only: it never mutates Stripe. Use it to adopt an existing
 * account as a starting point for a managed config.
 */
export async function pullConfig(stripe: Stripe): Promise<PullResult> {
  const warnings: string[] = []
  const products = await readActiveProducts(stripe, warnings)
  let priceCount = 0
  for (const p of products) priceCount += p.prices.length
  return {
    source: renderConfigSource(products),
    productCount: products.length,
    priceCount,
    warnings,
  }
}

async function readActiveProducts(stripe: Stripe, warnings: string[]): Promise<PulledProduct[]> {
  const raw: Stripe.Product[] = []
  for await (const product of stripe.products.list({ active: true, limit: 100 })) raw.push(product)

  const usedProductKeys = new Set<string>()
  const products: PulledProduct[] = []
  for (const product of raw) {
    const preferred = product.metadata?.[META_KEY] ?? slugify(product.name) ?? 'product'
    const key = uniqueKey(preferred, usedProductKeys)

    const features: Record<string, string> = {}
    for (const [k, v] of Object.entries(product.metadata ?? {})) {
      if (k.startsWith(FEATURE_PREFIX)) features[k.slice(FEATURE_PREFIX.length)] = v
    }

    const prices = await readActivePrices(stripe, product.id, key, warnings)
    // The schema requires at least one price per product, so a product with no
    // representable active price can't be emitted — skip it rather than produce
    // a config that fails its own validation.
    if (prices.length === 0) {
      warnings.push(
        `Skipped product "${product.name}" (${product.id}): no active fixed-amount prices.`,
      )
      usedProductKeys.delete(key)
      continue
    }

    products.push({
      key,
      name: product.name,
      description: product.description ?? null,
      features,
      prices,
    })
  }

  products.sort((a, b) => a.key.localeCompare(b.key))
  return products
}

async function readActivePrices(
  stripe: Stripe,
  productId: string,
  productKey: string,
  warnings: string[],
): Promise<PulledPrice[]> {
  const raw: Stripe.Price[] = []
  for await (const price of stripe.prices.list({ product: productId, active: true, limit: 100 })) {
    raw.push(price)
  }

  const usedKeys = new Set<string>()
  const prices: PulledPrice[] = []
  for (const price of raw) {
    // stripekit models fixed per-unit prices only. Tiered pricing and decimal-only
    // amounts report unit_amount === null and can't be represented — skip, don't coerce to 0.
    if (price.unit_amount === null) {
      warnings.push(
        `Skipped price ${price.id} on "${productKey}": no fixed unit_amount (tiered or decimal pricing).`,
      )
      continue
    }
    const interval = (price.recurring?.interval as Interval | undefined) ?? null
    const preferred = derivePriceKey(price, productKey, interval)
    prices.push({
      key: uniqueKey(preferred, usedKeys),
      amount: price.unit_amount,
      currency: price.currency,
      interval,
      intervalCount: price.recurring?.interval_count ?? 1,
      nickname: price.nickname ?? null,
      taxBehavior: (price.tax_behavior as TaxBehavior | null | undefined) ?? null,
    })
  }
  prices.sort((a, b) => a.key.localeCompare(b.key))
  return prices
}

function derivePriceKey(
  price: Stripe.Price,
  productKey: string,
  interval: Interval | null,
): string {
  const lookup = price.lookup_key
  if (lookup) {
    const prefix = `${productKey}_`
    const suffix = lookup.startsWith(prefix) ? lookup.slice(prefix.length) : lookup
    const slug = slugify(suffix)
    if (slug) return slug
  }
  if (interval) return { day: 'daily', week: 'weekly', month: 'monthly', year: 'yearly' }[interval]
  return 'one_time'
}

/* ------------------------------- serialization ------------------------------ */

function renderConfigSource(products: PulledProduct[]): string {
  const header = `import { defineConfig } from 'stripekit'\n\nexport default defineConfig({\n`
  const footer = `})\n`

  if (products.length === 0) {
    return (
      header +
      '  products: {\n' +
      '    // No active products found in your Stripe account yet. Add one:\n' +
      "    // pro: { name: 'Pro', prices: { monthly: { amount: 2000, currency: 'usd', interval: 'month' } } },\n" +
      '  },\n' +
      footer
    )
  }

  const body = '  products: {\n' + products.map((p) => renderProduct(p)).join('\n') + '\n  },\n'
  return header + body + footer
}

function renderProduct(product: PulledProduct): string {
  const lines: string[] = []
  lines.push(`    ${product.key}: {`)
  lines.push(`      name: ${quote(product.name)},`)
  if (product.description !== null) lines.push(`      description: ${quote(product.description)},`)
  lines.push(`      prices: {`)
  for (const price of product.prices) lines.push(`        ${price.key}: ${renderPrice(price)},`)
  lines.push(`      },`)
  const featureEntries = Object.entries(product.features)
  if (featureEntries.length) {
    const inner = featureEntries.map(([k, v]) => `${featureKey(k)}: ${quote(v)}`).join(', ')
    lines.push(`      features: { ${inner} },`)
  }
  lines.push(`    },`)
  return lines.join('\n')
}

function renderPrice(price: PulledPrice): string {
  const parts: string[] = []
  parts.push(`amount: ${price.amount}`)
  parts.push(`currency: ${quote(price.currency)}`)
  if (price.interval) parts.push(`interval: ${quote(price.interval)}`)
  if (price.interval && price.intervalCount > 1) parts.push(`intervalCount: ${price.intervalCount}`)
  if (price.nickname) parts.push(`nickname: ${quote(price.nickname)}`)
  if (price.taxBehavior === 'inclusive' || price.taxBehavior === 'exclusive') {
    parts.push(`taxBehavior: ${quote(price.taxBehavior)}`)
  }
  return `{ ${parts.join(', ')} }`
}

function quote(value: string): string {
  return `'${value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')}'`
}

/** Feature names that aren't valid identifiers get quoted as object keys. */
function featureKey(name: string): string {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name) ? name : quote(name)
}

function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
  if (!slug) return ''
  return /^[a-z]/.test(slug) ? slug : `p_${slug}`
}

function uniqueKey(preferred: string, used: Set<string>): string {
  const base = preferred || 'item'
  let candidate = base
  let n = 2
  while (used.has(candidate)) candidate = `${base}_${n++}`
  used.add(candidate)
  return candidate
}
