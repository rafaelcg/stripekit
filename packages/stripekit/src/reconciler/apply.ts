import type Stripe from 'stripe'
import { StripekitError } from '../util/errors'
import { stableIdempotencyKey } from '../util/hash'
import { withRateLimitRetry } from '../util/retry'
import { FEATURE_PREFIX, META_KEY, META_MANAGED } from '../stripe/tags'
import { describeAction } from './plan'
import type {
  Action,
  CurrentProduct,
  CurrentState,
  DesiredPortal,
  DesiredPrice,
  DesiredProduct,
  DesiredState,
  Plan,
} from './types'

export interface ApplyOptions {
  /** Called once per applied action, in execution order. */
  logger?: (line: string) => void
}

export interface ApplyOutcome {
  appliedCount: number
  /** Values the caller should persist to the env file. */
  envUpdates: Record<string, string>
}

/** Live, in-memory view of the catalog as actions are applied. */
interface ModelPrice {
  id: string
  active: boolean
  recurring: boolean
  currency: string
  interval: string | null
}
interface ModelProduct {
  id: string
  prices: Map<string, ModelPrice> // keyed by composite price key
}

interface ApplyCtx {
  model: Map<string, ModelProduct>
  currentByKey: Map<string, CurrentProduct>
  desired: DesiredState
  envUpdates: Record<string, string>
  log: (line: string) => void
}

// Execution order: products exist before their prices; prices are archived
// before the products that own them; portal is built last from final state.
const ORDER: Record<Action['kind'], number> = {
  create_product: 0,
  update_product: 1,
  create_price: 2,
  update_price: 3,
  replace_price: 4,
  archive_price: 5,
  archive_product: 6,
  create_webhook: 7,
  update_webhook: 8,
  create_portal: 9,
  update_portal: 10,
}

/**
 * Execute a plan against Stripe. Actions run sequentially in dependency order
 * with stable idempotency keys (so a crashed run is safe to re-run) and 429
 * backoff. Returns env values the caller must persist — notably the webhook
 * signing secret, which Stripe only reveals at creation time.
 */
export async function applyPlan(
  stripe: Stripe,
  plan: Plan,
  current: CurrentState,
  desired: DesiredState,
  opts: ApplyOptions = {},
): Promise<ApplyOutcome> {
  const log = opts.logger ?? (() => {})
  const ctx: ApplyCtx = {
    model: seedModel(current),
    currentByKey: new Map(current.products.map((p) => [p.key, p])),
    desired,
    envUpdates: {},
    log,
  }

  const actions = [...plan.actions].sort((a, b) => ORDER[a.kind] - ORDER[b.kind])
  for (const action of actions) {
    await executeAction(stripe, action, ctx)
    log(describeAction(action))
  }

  return { appliedCount: actions.length, envUpdates: ctx.envUpdates }
}

function seedModel(current: CurrentState): Map<string, ModelProduct> {
  const model = new Map<string, ModelProduct>()
  for (const cp of current.products) {
    const prices = new Map<string, ModelPrice>()
    for (const price of cp.prices) {
      prices.set(price.key, {
        id: price.id,
        active: price.active,
        recurring: price.interval !== null,
        currency: price.currency,
        interval: price.interval,
      })
    }
    model.set(cp.key, { id: cp.id, prices })
  }
  return model
}

async function executeAction(stripe: Stripe, action: Action, ctx: ApplyCtx): Promise<void> {
  switch (action.kind) {
    case 'create_product':
      return createProduct(stripe, action.desired, ctx)
    case 'update_product':
      return updateProduct(stripe, action.productId, action.productKey, action.desired, ctx)
    case 'create_price':
      return createPrice(stripe, action.productKey, action.desired, ctx)
    case 'update_price':
      return updatePrice(
        stripe,
        action.productKey,
        action.priceId,
        action.desired,
        action.changes,
        ctx,
      )
    case 'replace_price':
      return replacePrice(stripe, action.productKey, action.oldPriceId, action.desired, ctx)
    case 'archive_price':
      return archivePrice(stripe, action.productKey, action.priceKey, action.priceId, ctx)
    case 'archive_product':
      return archiveProduct(stripe, action.productId)
    case 'create_webhook':
      return createWebhook(stripe, action.url, action.events, ctx)
    case 'update_webhook':
      return updateWebhook(stripe, action.webhookId, action.url, action.events)
    case 'create_portal':
      return createPortal(stripe, action.desired, ctx)
    case 'update_portal':
      return updatePortal(stripe, action.portalId, action.desired, ctx)
  }
}

/* --------------------------------- products -------------------------------- */

async function createProduct(stripe: Stripe, dp: DesiredProduct, ctx: ApplyCtx): Promise<void> {
  const params: Stripe.ProductCreateParams = {
    name: dp.name,
    active: dp.active,
    metadata: buildProductMetadata(dp),
  }
  if (dp.description !== null) params.description = dp.description

  const idempotencyKey = stableIdempotencyKey('create_product', dp.key, params)
  const product = await withRateLimitRetry(() => stripe.products.create(params, { idempotencyKey }))
  ctx.model.set(dp.key, { id: product.id, prices: new Map() })
}

async function updateProduct(
  stripe: Stripe,
  productId: string,
  productKey: string,
  dp: DesiredProduct,
  ctx: ApplyCtx,
): Promise<void> {
  const desiredMeta = buildProductMetadata(dp)
  const metadata: Record<string, string> = { ...desiredMeta }
  // Clear managed/user keys that no longer exist (posting '' unsets a key).
  const cp = ctx.currentByKey.get(productKey)
  if (cp) {
    for (const key of Object.keys(cp.rawMetadata)) {
      if (!(key in desiredMeta)) metadata[key] = ''
    }
  }

  const params: Stripe.ProductUpdateParams = {
    name: dp.name,
    active: dp.active,
    description: dp.description ?? '',
    metadata,
  }
  const idempotencyKey = stableIdempotencyKey('update_product', productId, params)
  await withRateLimitRetry(() => stripe.products.update(productId, params, { idempotencyKey }))
  if (!ctx.model.has(dp.key)) ctx.model.set(dp.key, { id: productId, prices: new Map() })
}

async function archiveProduct(stripe: Stripe, productId: string): Promise<void> {
  const idempotencyKey = stableIdempotencyKey('archive_product', productId, { active: false })
  await withRateLimitRetry(() =>
    stripe.products.update(productId, { active: false }, { idempotencyKey }),
  )
}

function buildProductMetadata(dp: DesiredProduct): Record<string, string> {
  const metadata: Record<string, string> = { ...dp.userMetadata }
  for (const [name, value] of Object.entries(dp.features)) {
    metadata[FEATURE_PREFIX + name] = value
  }
  metadata[META_KEY] = dp.key
  return metadata
}

/* ---------------------------------- prices --------------------------------- */

async function createPrice(
  stripe: Stripe,
  productKey: string,
  dp: DesiredPrice,
  ctx: ApplyCtx,
): Promise<void> {
  const product = requireModelProduct(ctx, productKey, dp.key)
  const params = buildPriceCreateParams(dp, product.id)
  const idempotencyKey = stableIdempotencyKey('create_price', dp.key, params)
  const price = await withRateLimitRetry(() => stripe.prices.create(params, { idempotencyKey }))
  product.prices.set(dp.key, {
    id: price.id,
    active: true,
    recurring: dp.interval !== null,
    currency: dp.currency,
    interval: dp.interval,
  })
}

async function updatePrice(
  stripe: Stripe,
  productKey: string,
  priceId: string,
  dp: DesiredPrice,
  changes: { field: string }[],
  ctx: ApplyCtx,
): Promise<void> {
  const params: Stripe.PriceUpdateParams = {}
  for (const change of changes) {
    switch (change.field) {
      case 'active':
        params.active = true
        break
      case 'nickname':
        params.nickname = dp.nickname ?? ''
        break
      case 'lookupKey':
        params.lookup_key = dp.key
        params.transfer_lookup_key = true
        break
      case 'taxBehavior':
        if (dp.taxBehavior) params.tax_behavior = dp.taxBehavior
        break
    }
  }
  const idempotencyKey = stableIdempotencyKey('update_price', priceId, params)
  await withRateLimitRetry(() => stripe.prices.update(priceId, params, { idempotencyKey }))
  const mp = ctx.model.get(productKey)?.prices.get(dp.key)
  if (mp) mp.active = true
}

async function replacePrice(
  stripe: Stripe,
  productKey: string,
  oldPriceId: string,
  dp: DesiredPrice,
  ctx: ApplyCtx,
): Promise<void> {
  const product = requireModelProduct(ctx, productKey, dp.key)
  const createParams = buildPriceCreateParams(dp, product.id, { transferLookupKey: true })
  const createKey = stableIdempotencyKey('replace_price_create', dp.key, createParams)
  const newPrice = await withRateLimitRetry(() =>
    stripe.prices.create(createParams, { idempotencyKey: createKey }),
  )

  // transfer_lookup_key only moved the key off the old price; archive it separately.
  const archiveKey = stableIdempotencyKey('archive_price', oldPriceId, { active: false })
  await withRateLimitRetry(() =>
    stripe.prices.update(oldPriceId, { active: false }, { idempotencyKey: archiveKey }),
  )

  product.prices.set(dp.key, {
    id: newPrice.id,
    active: true,
    recurring: dp.interval !== null,
    currency: dp.currency,
    interval: dp.interval,
  })
}

async function archivePrice(
  stripe: Stripe,
  productKey: string,
  priceCompositeKey: string,
  priceId: string,
  ctx: ApplyCtx,
): Promise<void> {
  const idempotencyKey = stableIdempotencyKey('archive_price', priceId, { active: false })
  await withRateLimitRetry(() =>
    stripe.prices.update(priceId, { active: false }, { idempotencyKey }),
  )
  const mp = ctx.model.get(productKey)?.prices.get(priceCompositeKey)
  if (mp) mp.active = false
}

function buildPriceCreateParams(
  dp: DesiredPrice,
  productId: string,
  opts: { transferLookupKey?: boolean } = {},
): Stripe.PriceCreateParams {
  const params: Stripe.PriceCreateParams = {
    product: productId,
    currency: dp.currency,
    unit_amount: dp.unitAmount,
    lookup_key: dp.key,
    metadata: { [META_KEY]: dp.key },
  }
  if (opts.transferLookupKey) params.transfer_lookup_key = true
  if (dp.interval) params.recurring = { interval: dp.interval, interval_count: dp.intervalCount }
  if (dp.nickname) params.nickname = dp.nickname
  if (dp.taxBehavior) params.tax_behavior = dp.taxBehavior
  return params
}

function requireModelProduct(ctx: ApplyCtx, productKey: string, priceKey: string): ModelProduct {
  const product = ctx.model.get(productKey)
  if (!product) {
    throw new StripekitError(
      `Internal error: product "${productKey}" was not available before reconciling price "${priceKey}".`,
    )
  }
  return product
}

/* --------------------------------- webhooks -------------------------------- */

async function createWebhook(
  stripe: Stripe,
  url: string,
  events: string[],
  ctx: ApplyCtx,
): Promise<void> {
  const params: Stripe.WebhookEndpointCreateParams = {
    url,
    enabled_events: events as Stripe.WebhookEndpointCreateParams.EnabledEvent[],
    description: 'Managed by stripekit',
    metadata: { [META_MANAGED]: 'true' },
  }
  const idempotencyKey = stableIdempotencyKey('create_webhook', url, params)
  const endpoint = await withRateLimitRetry(() =>
    stripe.webhookEndpoints.create(params, { idempotencyKey }),
  )
  // The signing secret is only ever returned here — persist it now.
  if (endpoint.secret) ctx.envUpdates['STRIPE_WEBHOOK_SECRET'] = endpoint.secret
}

async function updateWebhook(
  stripe: Stripe,
  webhookId: string,
  url: string,
  events: string[],
): Promise<void> {
  const params: Stripe.WebhookEndpointUpdateParams = {
    url,
    enabled_events: events as Stripe.WebhookEndpointUpdateParams.EnabledEvent[],
  }
  const idempotencyKey = stableIdempotencyKey('update_webhook', webhookId, params)
  await withRateLimitRetry(() =>
    stripe.webhookEndpoints.update(webhookId, params, { idempotencyKey }),
  )
}

/* ---------------------------------- portal --------------------------------- */

async function createPortal(stripe: Stripe, portal: DesiredPortal, ctx: ApplyCtx): Promise<void> {
  const params = buildPortalParams(portal, ctx)
  const idempotencyKey = stableIdempotencyKey('create_portal', 'singleton', params)
  const cfg = await withRateLimitRetry(() =>
    stripe.billingPortal.configurations.create(params, { idempotencyKey }),
  )
  ctx.envUpdates['STRIPE_PORTAL_CONFIGURATION_ID'] = cfg.id
}

async function updatePortal(
  stripe: Stripe,
  portalId: string,
  portal: DesiredPortal,
  ctx: ApplyCtx,
): Promise<void> {
  const params = buildPortalParams(portal, ctx) as Stripe.BillingPortal.ConfigurationUpdateParams
  const idempotencyKey = stableIdempotencyKey('update_portal', portalId, params)
  await withRateLimitRetry(() =>
    stripe.billingPortal.configurations.update(portalId, params, { idempotencyKey }),
  )
  ctx.envUpdates['STRIPE_PORTAL_CONFIGURATION_ID'] = portalId
}

function buildPortalParams(
  portal: DesiredPortal,
  ctx: ApplyCtx,
): Stripe.BillingPortal.ConfigurationCreateParams {
  // subscription_update.enabled must track the desired planSwitching flag exactly,
  // independent of whether any switchable products exist — otherwise read-state
  // reads back `false` for a one-time-only catalog and the plan never converges.
  // (Stripe allows enabled:true with no products; customers just have nothing to
  // switch to.)
  let subscriptionUpdate: Stripe.BillingPortal.ConfigurationCreateParams.Features.SubscriptionUpdate
  if (portal.planSwitching) {
    subscriptionUpdate = {
      enabled: true,
      default_allowed_updates: ['price'],
      proration_behavior: 'create_prorations',
    }
    const products = buildSwitchableProducts(ctx)
    if (products.length) subscriptionUpdate.products = products
  } else {
    subscriptionUpdate = { enabled: false }
  }

  return {
    metadata: { [META_MANAGED]: 'true' },
    business_profile: { headline: 'Manage your subscription' },
    features: {
      invoice_history: { enabled: portal.invoiceHistory },
      payment_method_update: { enabled: portal.paymentMethodUpdate },
      customer_update: {
        enabled: true,
        allowed_updates: ['email', 'address', 'name', 'phone', 'tax_id'],
      },
      subscription_cancel: { enabled: portal.cancellations, mode: 'at_period_end' },
      subscription_update: subscriptionUpdate,
    },
  }
}

function buildSwitchableProducts(
  ctx: ApplyCtx,
): Stripe.BillingPortal.ConfigurationCreateParams.Features.SubscriptionUpdate.Product[] {
  const entries: { product: string; prices: string[]; currencies: string[] }[] = []

  for (const dp of ctx.desired.products) {
    if (!dp.active) continue
    const mp = ctx.model.get(dp.key)
    if (!mp) continue

    const seen = new Set<string>() // (currency, interval) must be unique within a product
    const priceIds: string[] = []
    const currencies: string[] = []
    for (const price of mp.prices.values()) {
      if (!price.active || !price.recurring) continue
      const signature = `${price.currency}:${price.interval}`
      if (seen.has(signature)) continue
      seen.add(signature)
      priceIds.push(price.id)
      currencies.push(price.currency)
    }
    if (priceIds.length) entries.push({ product: mp.id, prices: priceIds, currencies })
  }

  // Apply Stripe's 10-product cap BEFORE validating currency, so a divergent
  // currency in a product that the cap discards can't cause a spurious failure.
  let kept = entries
  if (entries.length > 10) {
    ctx.log(
      `warning: Stripe allows at most 10 plan-switchable products in the portal; including the first 10 of ${entries.length}.`,
    )
    kept = entries.slice(0, 10)
  }

  const currencies = new Set(kept.flatMap((e) => e.currencies))
  if (currencies.size > 1) {
    throw new StripekitError(
      `Customer portal plan-switching requires all switchable prices to share one currency, but found: ${[...currencies].join(', ')}.`,
      {
        hint: 'Align currencies across plan-switchable products, or set portal.planSwitching to false.',
      },
    )
  }

  return kept.map((e) => ({ product: e.product, prices: e.prices }))
}
