import { DEFAULT_WEBHOOK_EVENTS } from '../constants'
import type { StripekitConfig } from '../config/types'
import { RESERVED_PREFIX, priceCompositeKey, serializeFeatureValue } from '../stripe/tags'
import { StripekitError } from '../util/errors'
import type {
  DesiredPortal,
  DesiredPrice,
  DesiredProduct,
  DesiredState,
  DesiredWebhook,
} from './types'

export interface BuildDesiredOptions {
  /** Absolute base URL of the deployed app, used to resolve the webhook endpoint. */
  baseUrl?: string | null
}

/** Join a base URL and a path into a single absolute URL. */
export function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, '')
  const withScheme = /^https?:\/\//.test(base) ? base : `https://${base}`
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${withScheme}${suffix}`
}

/**
 * Derive the desired Stripe state purely from config. Products and prices are
 * emitted in a stable, sorted order so plans are deterministic.
 */
export function buildDesiredState(
  config: StripekitConfig,
  opts: BuildDesiredOptions = {},
): DesiredState {
  const products: DesiredProduct[] = Object.keys(config.products)
    .sort()
    .map((productKey) => {
      const product = config.products[productKey]!

      const prices: DesiredPrice[] = Object.keys(product.prices)
        .sort()
        .map((priceKey) => {
          const price = product.prices[priceKey]!
          const interval = price.interval ?? null
          return {
            key: priceCompositeKey(productKey, priceKey),
            priceKey,
            productKey,
            unitAmount: price.amount,
            currency: price.currency.toLowerCase(),
            interval,
            // intervalCount is meaningless for a one-time price; normalize to 1
            // so it matches what Stripe reports back.
            intervalCount: interval ? (price.intervalCount ?? 1) : 1,
            nickname: price.nickname ?? null,
            taxBehavior: price.taxBehavior ?? null,
          }
        })

      const features: Record<string, string> = {}
      for (const [name, value] of Object.entries(product.features ?? {})) {
        features[name] = serializeFeatureValue(value)
      }

      const userMetadata: Record<string, string> = {}
      for (const [k, v] of Object.entries(product.metadata ?? {})) {
        if (!k.startsWith(RESERVED_PREFIX)) userMetadata[k] = v
      }

      return {
        key: productKey,
        name: product.name,
        description: product.description ?? null,
        active: product.active ?? true,
        features,
        userMetadata,
        prices,
      }
    })

  assertUniquePriceKeys(products)

  return {
    products,
    webhook: buildDesiredWebhook(config, opts),
    portal: buildDesiredPortal(config),
  }
}

/**
 * Composite keys (`product_price`) become Stripe lookup keys, which must be
 * unique. `pro` + `monthly_eur` and `pro_monthly` + `eur` both collide on
 * `pro_monthly_eur`, so reject that rather than silently contend for one key.
 */
function assertUniquePriceKeys(products: DesiredProduct[]): void {
  const seen = new Map<string, string>()
  for (const product of products) {
    for (const price of product.prices) {
      const owner = `${price.productKey}.${price.priceKey}`
      const prior = seen.get(price.key)
      if (prior) {
        throw new StripekitError(
          `Two prices produce the same lookup key "${price.key}": ${prior} and ${owner}.`,
          { hint: 'Rename a product or price key so their "product_price" combination is unique.' },
        )
      }
      seen.set(price.key, owner)
    }
  }
}

function buildDesiredWebhook(
  config: StripekitConfig,
  opts: BuildDesiredOptions,
): DesiredWebhook | null {
  if (!config.webhooks) return null
  if (!opts.baseUrl) return null // no deployment URL to point at yet — skip, not an error
  // Treat an explicitly empty events array as "use defaults", and dedupe so the
  // registered set matches what Stripe stores (it dedupes) and reconciles cleanly.
  const configured = config.webhooks.events?.length
    ? config.webhooks.events
    : DEFAULT_WEBHOOK_EVENTS
  return {
    url: joinUrl(opts.baseUrl, config.webhooks.path),
    events: [...new Set(configured)],
  }
}

function buildDesiredPortal(config: StripekitConfig): DesiredPortal | null {
  if (config.portal === false || config.portal == null) return null
  const p = config.portal
  return {
    cancellations: p.cancellations ?? true,
    planSwitching: p.planSwitching ?? true,
    paymentMethodUpdate: p.paymentMethodUpdate ?? true,
    invoiceHistory: p.invoiceHistory ?? true,
  }
}
