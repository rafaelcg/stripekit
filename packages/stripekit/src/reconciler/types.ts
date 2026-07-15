import type { Interval, TaxBehavior } from '../config/types'

/* ------------------------------------------------------------------ *
 * Desired state — derived purely from stripe.config.ts
 * ------------------------------------------------------------------ */

export interface DesiredPrice {
  /** Composite stable key, e.g. `pro_monthly`. Also the Stripe `lookup_key`. */
  key: string
  /** The price slug within its product, e.g. `monthly`. */
  priceKey: string
  /** The owning product's key, e.g. `pro`. */
  productKey: string
  unitAmount: number
  currency: string
  /** `null` for a one-time price. */
  interval: Interval | null
  intervalCount: number
  nickname: string | null
  taxBehavior: TaxBehavior | null
}

export interface DesiredProduct {
  key: string
  name: string
  description: string | null
  active: boolean
  /** Feature name -> serialized value. */
  features: Record<string, string>
  /** User-supplied metadata (reserved stripekit_* keys already stripped). */
  userMetadata: Record<string, string>
  prices: DesiredPrice[]
}

export interface DesiredWebhook {
  /** Fully-resolved absolute endpoint URL (base + config path). */
  url: string
  events: string[]
}

export interface DesiredPortal {
  cancellations: boolean
  planSwitching: boolean
  paymentMethodUpdate: boolean
  invoiceHistory: boolean
}

export interface DesiredState {
  products: DesiredProduct[]
  webhook: DesiredWebhook | null
  portal: DesiredPortal | null
}

/* ------------------------------------------------------------------ *
 * Current state — read back from Stripe (managed objects only)
 * ------------------------------------------------------------------ */

export interface CurrentPrice {
  id: string
  key: string
  unitAmount: number | null
  currency: string
  interval: Interval | null
  intervalCount: number
  nickname: string | null
  active: boolean
  lookupKey: string | null
  taxBehavior: TaxBehavior | null
}

export interface CurrentProduct {
  id: string
  key: string
  name: string
  description: string | null
  active: boolean
  features: Record<string, string>
  userMetadata: Record<string, string>
  /** The product's complete raw Stripe metadata, used to clear removed keys on update. */
  rawMetadata: Record<string, string>
  prices: CurrentPrice[]
}

export interface CurrentWebhook {
  id: string
  url: string
  enabledEvents: string[]
}

export interface CurrentPortal {
  id: string
  cancellations: boolean
  planSwitching: boolean
  paymentMethodUpdate: boolean
  invoiceHistory: boolean
}

export interface CurrentState {
  products: CurrentProduct[]
  webhook: CurrentWebhook | null
  portal: CurrentPortal | null
}

/* ------------------------------------------------------------------ *
 * Plan — the diff between desired and current
 * ------------------------------------------------------------------ */

export interface FieldChange {
  field: string
  from: unknown
  to: unknown
}

export type Action =
  | { kind: 'create_product'; productKey: string; desired: DesiredProduct }
  | {
      kind: 'update_product'
      productKey: string
      productId: string
      desired: DesiredProduct
      changes: FieldChange[]
    }
  | { kind: 'archive_product'; productKey: string; productId: string; name: string }
  | { kind: 'create_price'; priceKey: string; productKey: string; desired: DesiredPrice }
  | {
      kind: 'update_price'
      priceKey: string
      priceId: string
      productKey: string
      desired: DesiredPrice
      changes: FieldChange[]
    }
  | {
      kind: 'replace_price'
      priceKey: string
      productKey: string
      oldPriceId: string
      desired: DesiredPrice
      changes: FieldChange[]
    }
  | { kind: 'archive_price'; priceKey: string; priceId: string; productKey: string }
  | { kind: 'create_webhook'; url: string; events: string[] }
  | {
      kind: 'update_webhook'
      webhookId: string
      url: string
      events: string[]
      changes: FieldChange[]
    }
  | { kind: 'create_portal'; desired: DesiredPortal }
  | { kind: 'update_portal'; portalId: string; desired: DesiredPortal; changes: FieldChange[] }

export type ActionKind = Action['kind']

export interface Plan {
  actions: Action[]
}

/** Classifies an action for rendering and summary counts. */
export function actionEffect(kind: ActionKind): 'create' | 'update' | 'destroy' | 'replace' {
  switch (kind) {
    case 'create_product':
    case 'create_price':
    case 'create_webhook':
    case 'create_portal':
      return 'create'
    case 'update_product':
    case 'update_price':
    case 'update_webhook':
    case 'update_portal':
      return 'update'
    case 'archive_product':
    case 'archive_price':
      return 'destroy'
    case 'replace_price':
      return 'replace'
  }
}
