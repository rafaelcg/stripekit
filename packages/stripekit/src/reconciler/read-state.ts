import type Stripe from 'stripe'
import type { Interval, TaxBehavior } from '../config/types'
import { FEATURE_PREFIX, META_KEY, META_MANAGED, RESERVED_PREFIX } from '../stripe/tags'
import type {
  CurrentPortal,
  CurrentPrice,
  CurrentProduct,
  CurrentState,
  CurrentWebhook,
} from './types'

const PAGE = 100

/**
 * Read the current state of stripekit-managed objects from Stripe. Only objects
 * carrying our metadata tags are returned — anything created by hand is ignored,
 * so reconciliation can never clobber it. Includes archived (inactive) objects
 * so they can be reactivated rather than duplicated.
 */
export async function readCurrentState(stripe: Stripe): Promise<CurrentState> {
  const products = await readManagedProducts(stripe)
  const [webhook, portal] = await Promise.all([
    readManagedWebhook(stripe),
    readManagedPortal(stripe),
  ])
  return { products, webhook, portal }
}

async function readManagedProducts(stripe: Stripe): Promise<CurrentProduct[]> {
  const managed: Stripe.Product[] = []
  // No server-side metadata filter exists; page through all and match our tag.
  for await (const product of stripe.products.list({ limit: PAGE })) {
    if (product.metadata?.[META_KEY]) managed.push(product)
  }

  const result: CurrentProduct[] = []
  for (const product of managed) {
    const prices = await readPricesForProduct(stripe, product.id)
    result.push(mapProduct(product, prices))
  }
  return result
}

async function readPricesForProduct(stripe: Stripe, productId: string): Promise<CurrentPrice[]> {
  const prices: CurrentPrice[] = []
  for await (const price of stripe.prices.list({ product: productId, limit: PAGE })) {
    // Ownership is decided ONLY by our metadata tag. lookup_key is a first-class
    // field any user can set, so it must never mark a hand-made price as managed.
    const key = price.metadata?.[META_KEY]
    if (!key) continue // not one of ours
    prices.push(mapPrice(price, key))
  }
  return prices
}

function mapProduct(product: Stripe.Product, prices: CurrentPrice[]): CurrentProduct {
  const features: Record<string, string> = {}
  const userMetadata: Record<string, string> = {}
  for (const [k, v] of Object.entries(product.metadata ?? {})) {
    if (k.startsWith(FEATURE_PREFIX)) {
      features[k.slice(FEATURE_PREFIX.length)] = v
    } else if (!k.startsWith(RESERVED_PREFIX)) {
      userMetadata[k] = v
    }
  }
  return {
    id: product.id,
    key: product.metadata![META_KEY]!,
    name: product.name,
    description: product.description ?? null,
    active: product.active,
    features,
    userMetadata,
    rawMetadata: { ...(product.metadata ?? {}) },
    prices,
  }
}

function mapPrice(price: Stripe.Price, key: string): CurrentPrice {
  return {
    id: price.id,
    key,
    unitAmount: price.unit_amount,
    currency: price.currency,
    interval: (price.recurring?.interval as Interval | undefined) ?? null,
    intervalCount: price.recurring?.interval_count ?? 1,
    nickname: price.nickname ?? null,
    active: price.active,
    lookupKey: price.lookup_key ?? null,
    taxBehavior: (price.tax_behavior as TaxBehavior | null | undefined) ?? null,
  }
}

async function readManagedWebhook(stripe: Stripe): Promise<CurrentWebhook | null> {
  for await (const endpoint of stripe.webhookEndpoints.list({ limit: PAGE })) {
    if (endpoint.metadata?.[META_MANAGED] === 'true') {
      return { id: endpoint.id, url: endpoint.url, enabledEvents: [...endpoint.enabled_events] }
    }
  }
  return null
}

async function readManagedPortal(stripe: Stripe): Promise<CurrentPortal | null> {
  for await (const cfg of stripe.billingPortal.configurations.list({ limit: PAGE })) {
    if (cfg.metadata?.[META_MANAGED] === 'true') {
      const f = cfg.features
      return {
        id: cfg.id,
        cancellations: f.subscription_cancel?.enabled ?? false,
        planSwitching: f.subscription_update?.enabled ?? false,
        paymentMethodUpdate: f.payment_method_update?.enabled ?? false,
        invoiceHistory: f.invoice_history?.enabled ?? false,
      }
    }
  }
  return null
}
