import type { TaxBehavior } from '../config/types'
import type {
  Action,
  CurrentPrice,
  CurrentProduct,
  CurrentState,
  DesiredPortal,
  DesiredPrice,
  DesiredProduct,
  DesiredState,
  FieldChange,
  Plan,
} from './types'

/**
 * Compute the plan that reconciles `current` (read from Stripe, managed objects
 * only) toward `desired` (derived from config). Pure and deterministic: the same
 * inputs always produce the same ordered action list, which is what makes the
 * printed plan trustworthy and the function unit-testable without a network.
 */
export function diff(desired: DesiredState, current: CurrentState): Plan {
  const actions: Action[] = []
  const currentByKey = new Map(current.products.map((p) => [p.key, p]))
  const desiredKeys = new Set(desired.products.map((p) => p.key))

  // Products in desired -> create or update, then reconcile their prices.
  for (const dp of desired.products) {
    const cp = currentByKey.get(dp.key)
    if (!cp) {
      actions.push({ kind: 'create_product', productKey: dp.key, desired: dp })
      for (const price of dp.prices) {
        actions.push({
          kind: 'create_price',
          priceKey: price.key,
          productKey: dp.key,
          desired: price,
        })
      }
      continue
    }

    const productChanges = diffProductFields(dp, cp)
    if (productChanges.length) {
      actions.push({
        kind: 'update_product',
        productKey: dp.key,
        productId: cp.id,
        desired: dp,
        changes: productChanges,
      })
    }
    diffPrices(dp, cp, actions)
  }

  // Products removed from config -> archive them and their still-active prices.
  for (const cp of current.products) {
    if (desiredKeys.has(cp.key)) continue
    for (const price of cp.prices) {
      if (price.active) {
        actions.push({
          kind: 'archive_price',
          priceKey: price.key,
          priceId: price.id,
          productKey: cp.key,
        })
      }
    }
    if (cp.active) {
      actions.push({ kind: 'archive_product', productKey: cp.key, productId: cp.id, name: cp.name })
    }
  }

  diffWebhook(desired, current, actions)
  // The portal's switchable-plan list is derived from products/prices, so a
  // catalog change must refresh it even when the portal's own settings are unchanged.
  diffPortal(
    desired,
    current,
    actions,
    actions.some((a) => isCatalogAction(a.kind)),
  )

  return { actions }
}

function isCatalogAction(kind: Action['kind']): boolean {
  return (
    kind === 'create_product' ||
    kind === 'archive_product' ||
    kind === 'create_price' ||
    kind === 'update_price' ||
    kind === 'replace_price' ||
    kind === 'archive_price'
  )
}

function diffProductFields(dp: DesiredProduct, cp: CurrentProduct): FieldChange[] {
  const changes: FieldChange[] = []
  if (dp.name !== cp.name) changes.push({ field: 'name', from: cp.name, to: dp.name })
  if (dp.description !== cp.description) {
    changes.push({ field: 'description', from: cp.description, to: dp.description })
  }
  if (dp.active !== cp.active) changes.push({ field: 'active', from: cp.active, to: dp.active })
  if (!recordsEqual(dp.features, cp.features)) {
    changes.push({ field: 'features', from: cp.features, to: dp.features })
  }
  if (!recordsEqual(dp.userMetadata, cp.userMetadata)) {
    changes.push({ field: 'metadata', from: cp.userMetadata, to: dp.userMetadata })
  }
  return changes
}

function diffPrices(dp: DesiredProduct, cp: CurrentProduct, actions: Action[]): void {
  // A stripekit key can map to more than one Stripe price: after a replace the
  // archived old copy keeps its metadata key, and a crash between "create
  // replacement" and "archive old" can briefly leave two *active* prices sharing
  // a key. Group by key, pick a deterministic canonical, and heal any strays.
  const byKey = new Map<string, CurrentPrice[]>()
  for (const price of cp.prices) {
    const list = byKey.get(price.key)
    if (list) list.push(price)
    else byKey.set(price.key, [price])
  }
  const desiredKeys = new Set(dp.prices.map((p) => p.key))

  for (const dprice of dp.prices) {
    const candidates = byKey.get(dprice.key) ?? []
    const canonical = pickCanonicalPrice(candidates, dprice.key)
    if (!canonical) {
      actions.push({
        kind: 'create_price',
        priceKey: dprice.key,
        productKey: dp.key,
        desired: dprice,
      })
      continue
    }

    const immutableChanges = diffImmutablePriceFields(dprice, canonical)
    if (immutableChanges.length) {
      // Stripe prices are immutable on these fields: recreate and move the
      // lookup key over, archiving the old price.
      actions.push({
        kind: 'replace_price',
        priceKey: dprice.key,
        productKey: dp.key,
        oldPriceId: canonical.id,
        desired: dprice,
        changes: immutableChanges,
      })
    } else {
      const mutableChanges = diffMutablePriceFields(dprice, canonical)
      if (mutableChanges.length) {
        actions.push({
          kind: 'update_price',
          priceKey: dprice.key,
          priceId: canonical.id,
          productKey: dp.key,
          desired: dprice,
          changes: mutableChanges,
        })
      }
    }

    // Heal any other still-active price sharing this key (e.g. a crashed replace).
    for (const other of candidates) {
      if (other.id !== canonical.id && other.active) {
        actions.push({
          kind: 'archive_price',
          priceKey: other.key,
          priceId: other.id,
          productKey: dp.key,
        })
      }
    }
  }

  // Price keys removed from config -> archive every still-active price for them.
  for (const [key, candidates] of byKey) {
    if (desiredKeys.has(key)) continue
    for (const price of candidates) {
      if (price.active) {
        actions.push({
          kind: 'archive_price',
          priceKey: price.key,
          priceId: price.id,
          productKey: dp.key,
        })
      }
    }
  }
}

/**
 * Choose which of several prices sharing a key is authoritative: the one that
 * actually holds the lookup key, else any active price, else any price at all
 * (so an all-archived key can be reactivated rather than duplicated).
 */
function pickCanonicalPrice(candidates: CurrentPrice[], key: string): CurrentPrice | undefined {
  return (
    candidates.find((p) => p.active && p.lookupKey === key) ??
    candidates.find((p) => p.active) ??
    candidates[0]
  )
}

function diffImmutablePriceFields(dprice: DesiredPrice, cprice: CurrentPrice): FieldChange[] {
  const changes: FieldChange[] = []
  if (dprice.unitAmount !== cprice.unitAmount) {
    changes.push({ field: 'amount', from: cprice.unitAmount, to: dprice.unitAmount })
  }
  if (dprice.currency !== cprice.currency) {
    changes.push({ field: 'currency', from: cprice.currency, to: dprice.currency })
  }
  if (dprice.interval !== cprice.interval) {
    changes.push({ field: 'interval', from: cprice.interval, to: dprice.interval })
  }
  // intervalCount only means anything for recurring prices; comparing it for a
  // one-time price (where Stripe reports 1) would loop replacing forever.
  if (dprice.interval !== null && dprice.intervalCount !== cprice.intervalCount) {
    changes.push({ field: 'intervalCount', from: cprice.intervalCount, to: dprice.intervalCount })
  }
  // tax_behavior is immutable once set to a concrete value; changing it then
  // requires a new price.
  if (
    dprice.taxBehavior !== null &&
    dprice.taxBehavior !== cprice.taxBehavior &&
    isConcreteTaxBehavior(cprice.taxBehavior)
  ) {
    changes.push({ field: 'taxBehavior', from: cprice.taxBehavior, to: dprice.taxBehavior })
  }
  return changes
}

function diffMutablePriceFields(dprice: DesiredPrice, cprice: CurrentPrice): FieldChange[] {
  const changes: FieldChange[] = []
  if (dprice.nickname !== cprice.nickname) {
    changes.push({ field: 'nickname', from: cprice.nickname, to: dprice.nickname })
  }
  if (!cprice.active) {
    changes.push({ field: 'active', from: false, to: true })
  }
  if (cprice.lookupKey !== dprice.key) {
    changes.push({ field: 'lookupKey', from: cprice.lookupKey, to: dprice.key })
  }
  // tax_behavior is settable while still 'unspecified'/unset.
  if (
    dprice.taxBehavior !== null &&
    dprice.taxBehavior !== cprice.taxBehavior &&
    !isConcreteTaxBehavior(cprice.taxBehavior)
  ) {
    changes.push({ field: 'taxBehavior', from: cprice.taxBehavior, to: dprice.taxBehavior })
  }
  return changes
}

function diffWebhook(desired: DesiredState, current: CurrentState, actions: Action[]): void {
  if (!desired.webhook) return // unresolved URL or no webhook config -> leave current untouched
  if (!current.webhook) {
    actions.push({
      kind: 'create_webhook',
      url: desired.webhook.url,
      events: desired.webhook.events,
    })
    return
  }
  const changes: FieldChange[] = []
  if (current.webhook.url !== desired.webhook.url) {
    changes.push({ field: 'url', from: current.webhook.url, to: desired.webhook.url })
  }
  if (!stringSetsEqual(current.webhook.enabledEvents, desired.webhook.events)) {
    changes.push({
      field: 'events',
      from: current.webhook.enabledEvents,
      to: desired.webhook.events,
    })
  }
  if (changes.length) {
    actions.push({
      kind: 'update_webhook',
      webhookId: current.webhook.id,
      url: desired.webhook.url,
      events: desired.webhook.events,
      changes,
    })
  }
}

function diffPortal(
  desired: DesiredState,
  current: CurrentState,
  actions: Action[],
  catalogChanged: boolean,
): void {
  if (!desired.portal) return
  if (!current.portal) {
    actions.push({ kind: 'create_portal', desired: desired.portal })
    return
  }
  const changes: FieldChange[] = []
  for (const field of [
    'cancellations',
    'planSwitching',
    'paymentMethodUpdate',
    'invoiceHistory',
  ] as const) {
    if (desired.portal[field] !== current.portal[field]) {
      changes.push({ field, from: current.portal[field], to: desired.portal[field] })
    }
  }
  // Refresh when settings changed, or when plan-switching is on and the catalog moved.
  if (changes.length || (desired.portal.planSwitching && catalogChanged)) {
    actions.push({
      kind: 'update_portal',
      portalId: current.portal.id,
      desired: desired.portal,
      changes,
    })
  }
}

function isConcreteTaxBehavior(value: TaxBehavior | null): boolean {
  return value === 'inclusive' || value === 'exclusive'
}

function recordsEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  for (const k of aKeys) {
    if (a[k] !== b[k]) return false
  }
  return true
}

function stringSetsEqual(a: readonly string[], b: readonly string[]): boolean {
  const setA = new Set(a)
  const setB = new Set(b)
  if (setA.size !== setB.size) return false
  for (const x of setA) if (!setB.has(x)) return false
  return true
}
