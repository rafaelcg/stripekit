/**
 * Public configuration types for `stripe.config.ts`.
 *
 * These describe the *desired* state of your Stripe catalog. `stripekit push`
 * reconciles your real Stripe account against this file; the same config
 * targets test and live mode, which is what keeps the two from drifting.
 */

/** Recurring billing interval. Omit `interval` on a price to make it one-time. */
export type Interval = 'day' | 'week' | 'month' | 'year'

/** ISO-4217 tax behavior for a price. */
export type TaxBehavior = 'inclusive' | 'exclusive' | 'unspecified'

/**
 * A feature entitlement attached to a product. Stored in Stripe product
 * metadata and surfaced by the generated `hasFeature()` helper, so you get
 * plan-gating without a hosted control plane.
 */
export type FeatureValue = string | number | boolean

export interface PriceConfig {
  /**
   * Price in the currency's minor unit (e.g. cents). `2000` = $20.00.
   * This is immutable in Stripe — changing it makes `push` create a new price
   * and move the lookup key onto it, archiving the old one.
   */
  amount: number
  /** Lowercase ISO-4217 currency code, e.g. `'usd'`. */
  currency: string
  /** Recurring interval. Omit for a one-time price. */
  interval?: Interval
  /** Number of intervals between charges. Defaults to `1`. */
  intervalCount?: number
  /** Human-readable label shown in the Stripe dashboard. */
  nickname?: string
  /** How tax is handled for this price. */
  taxBehavior?: TaxBehavior
}

export interface ProductConfig {
  /** Display name of the product. */
  name: string
  /** Optional marketing description. */
  description?: string
  /**
   * Named prices for this product. The key (e.g. `monthly`) is combined with
   * the product key to form a stable `lookup_key` (`pro_monthly`) that your
   * checkout code references — so price amounts can change without touching app code.
   */
  prices: Record<string, PriceConfig>
  /** Feature entitlements, surfaced via the generated `hasFeature()` helper. */
  features?: Record<string, FeatureValue>
  /** Set `false` to archive the product. Defaults to `true`. */
  active?: boolean
  /** Extra metadata to merge onto the Stripe product (stripekit_* keys are reserved). */
  metadata?: Record<string, string>
}

export interface WebhookConfig {
  /** Route path of your webhook handler, e.g. `'/api/stripe/webhook'`. */
  path: string
  /**
   * Override the set of events the endpoint subscribes to. Defaults to the
   * minimal set the generated handler actually processes.
   */
  events?: string[]
}

export interface PortalConfig {
  /** Allow customers to cancel their subscription from the portal. */
  cancellations?: boolean
  /** Allow customers to switch between the products/prices you manage. */
  planSwitching?: boolean
  /** Allow customers to update their payment method. */
  paymentMethodUpdate?: boolean
  /** Show invoice history in the portal. */
  invoiceHistory?: boolean
}

/** Where the generated `sync.ts` persists canonical customer state. */
export type SyncAdapter = 'drizzle' | 'kv' | 'prisma'

export interface StripekitConfig {
  /** The products in your catalog, keyed by a stable slug (`pro`, `team`). */
  products: Record<string, ProductConfig>
  /** Webhook endpoint to register when a deployment URL is available. */
  webhooks?: WebhookConfig
  /** Customer portal configuration. Set `false` to leave the portal unmanaged. */
  portal?: PortalConfig | false
  /** Which adapter the generated code uses to persist synced state. */
  sync?: { adapter: SyncAdapter }
}
