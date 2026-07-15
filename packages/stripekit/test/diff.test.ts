import { describe, expect, it } from 'vitest'
import { diff } from '../src/reconciler/diff'
import type {
  Action,
  CurrentPrice,
  CurrentProduct,
  CurrentState,
  DesiredPortal,
  DesiredPrice,
  DesiredProduct,
  DesiredState,
  DesiredWebhook,
  Plan,
} from '../src/reconciler/types'

const dPrice = (p: Partial<DesiredPrice> = {}): DesiredPrice => ({
  key: 'pro_monthly',
  priceKey: 'monthly',
  productKey: 'pro',
  unitAmount: 2000,
  currency: 'usd',
  interval: 'month',
  intervalCount: 1,
  nickname: null,
  taxBehavior: null,
  ...p,
})

const dProduct = (p: Partial<DesiredProduct> = {}): DesiredProduct => ({
  key: 'pro',
  name: 'Pro',
  description: null,
  active: true,
  features: {},
  userMetadata: {},
  prices: [dPrice()],
  ...p,
})

const dState = (p: Partial<DesiredState> = {}): DesiredState => ({
  products: [dProduct()],
  webhook: null,
  portal: null,
  ...p,
})

const cPrice = (p: Partial<CurrentPrice> = {}): CurrentPrice => ({
  id: 'price_1',
  key: 'pro_monthly',
  unitAmount: 2000,
  currency: 'usd',
  interval: 'month',
  intervalCount: 1,
  nickname: null,
  active: true,
  lookupKey: 'pro_monthly',
  taxBehavior: null,
  ...p,
})

const cProduct = (p: Partial<CurrentProduct> = {}): CurrentProduct => ({
  id: 'prod_1',
  key: 'pro',
  name: 'Pro',
  description: null,
  active: true,
  features: {},
  userMetadata: {},
  rawMetadata: { stripekit_key: 'pro' },
  prices: [cPrice()],
  ...p,
})

const cState = (p: Partial<CurrentState> = {}): CurrentState => ({
  products: [cProduct()],
  webhook: null,
  portal: null,
  ...p,
})

const kinds = (plan: Plan): Action['kind'][] => plan.actions.map((a) => a.kind)
const find = <K extends Action['kind']>(
  plan: Plan,
  kind: K,
): Extract<Action, { kind: K }> | undefined =>
  plan.actions.find((a): a is Extract<Action, { kind: K }> => a.kind === kind)

describe('diff — products & prices', () => {
  it('creates a product and its prices on an empty account', () => {
    const plan = diff(dState(), cState({ products: [] }))
    expect(kinds(plan)).toEqual(['create_product', 'create_price'])
  })

  it('produces no actions when account already matches config', () => {
    const plan = diff(dState(), cState())
    expect(plan.actions).toEqual([])
  })

  it('replaces a price when the amount changes (immutable field)', () => {
    const plan = diff(
      dState({ products: [dProduct({ prices: [dPrice({ unitAmount: 2500 })] })] }),
      cState(),
    )
    const replace = find(plan, 'replace_price')
    expect(replace).toBeDefined()
    expect(replace!.oldPriceId).toBe('price_1')
    expect(replace!.changes.map((c) => c.field)).toContain('amount')
  })

  it('replaces a price when the interval changes', () => {
    const plan = diff(
      dState({ products: [dProduct({ prices: [dPrice({ interval: 'year' })] })] }),
      cState(),
    )
    expect(kinds(plan)).toContain('replace_price')
  })

  it('updates a price in place when only the nickname changes', () => {
    const plan = diff(
      dState({ products: [dProduct({ prices: [dPrice({ nickname: 'Monthly' })] })] }),
      cState(),
    )
    const update = find(plan, 'update_price')
    expect(update).toBeDefined()
    expect(update!.changes.map((c) => c.field)).toEqual(['nickname'])
  })

  it('reactivates an archived price rather than recreating it', () => {
    const plan = diff(
      dState(),
      cState({ products: [cProduct({ prices: [cPrice({ active: false })] })] }),
    )
    const update = find(plan, 'update_price')
    expect(update).toBeDefined()
    expect(update!.changes.map((c) => c.field)).toContain('active')
  })

  it('repoints a mismatched lookup key', () => {
    const plan = diff(
      dState(),
      cState({ products: [cProduct({ prices: [cPrice({ lookupKey: 'stale' })] })] }),
    )
    const update = find(plan, 'update_price')
    expect(update!.changes.map((c) => c.field)).toContain('lookupKey')
  })

  it('updates product fields (name, description, features, metadata)', () => {
    const plan = diff(
      dState({ products: [dProduct({ name: 'Pro Plus', features: { seats: '10' } })] }),
      cState(),
    )
    const update = find(plan, 'update_product')
    expect(update).toBeDefined()
    expect(update!.changes.map((c) => c.field).sort()).toEqual(['features', 'name'])
  })

  it('archives a product and its active prices when removed from config', () => {
    const plan = diff(dState({ products: [] }), cState())
    expect(kinds(plan).sort()).toEqual(['archive_price', 'archive_product'])
  })

  it('archives a single removed price but keeps the product', () => {
    const two = cProduct({
      prices: [
        cPrice(),
        cPrice({
          id: 'price_2',
          key: 'pro_yearly',
          lookupKey: 'pro_yearly',
          interval: 'year',
          unitAmount: 19200,
        }),
      ],
    })
    const plan = diff(dState(), cState({ products: [two] }))
    expect(kinds(plan)).toEqual(['archive_price'])
    expect(find(plan, 'archive_price')!.priceId).toBe('price_2')
  })

  it('does not re-archive an already-inactive removed price', () => {
    const withArchived = cProduct({
      prices: [
        cPrice(),
        cPrice({ id: 'price_2', key: 'pro_yearly', active: false, interval: 'year' }),
      ],
    })
    const plan = diff(dState(), cState({ products: [withArchived] }))
    expect(plan.actions).toEqual([])
  })

  it('ignores intervalCount for one-time prices (no destructive churn)', () => {
    const plan = diff(
      dState({ products: [dProduct({ prices: [dPrice({ interval: null, intervalCount: 2 })] })] }),
      cState({ products: [cProduct({ prices: [cPrice({ interval: null, intervalCount: 1 })] })] }),
    )
    expect(plan.actions).toEqual([])
  })
})

describe('diff — tax behavior transitions', () => {
  it('updates in place when moving away from unspecified', () => {
    const plan = diff(
      dState({ products: [dProduct({ prices: [dPrice({ taxBehavior: 'exclusive' })] })] }),
      cState({ products: [cProduct({ prices: [cPrice({ taxBehavior: 'unspecified' })] })] }),
    )
    expect(kinds(plan)).toContain('update_price')
    expect(kinds(plan)).not.toContain('replace_price')
  })

  it('replaces the price when changing an already-set tax behavior', () => {
    const plan = diff(
      dState({ products: [dProduct({ prices: [dPrice({ taxBehavior: 'inclusive' })] })] }),
      cState({ products: [cProduct({ prices: [cPrice({ taxBehavior: 'exclusive' })] })] }),
    )
    expect(kinds(plan)).toContain('replace_price')
  })
})

describe('diff — duplicate keys after replace', () => {
  it('matches the active price when an archived duplicate shares its key (order-independent)', () => {
    // Newest-first ordering: active new price appears before archived old price.
    const product = cProduct({
      prices: [
        cPrice({ id: 'price_new', active: true, unitAmount: 2000, lookupKey: 'pro_monthly' }),
        cPrice({ id: 'price_old', active: false, unitAmount: 1500, lookupKey: null }),
      ],
    })
    const plan = diff(dState(), cState({ products: [product] }))
    expect(plan.actions).toEqual([])
  })

  it('heals a crashed replace: archives the stray active price without the lookup key', () => {
    // Crash between "create replacement" and "archive old": both active, only
    // the new one holds the lookup key and matches desired (2000).
    const product = cProduct({
      prices: [
        cPrice({ id: 'price_new', active: true, unitAmount: 2000, lookupKey: 'pro_monthly' }),
        cPrice({ id: 'price_old', active: true, unitAmount: 1500, lookupKey: null }),
      ],
    })
    const plan = diff(dState(), cState({ products: [product] }))
    expect(kinds(plan)).toEqual(['archive_price'])
    expect(find(plan, 'archive_price')!.priceId).toBe('price_old')
  })
})

describe('diff — webhook', () => {
  const webhook: DesiredWebhook = {
    url: 'https://app.example.com/api/stripe/webhook',
    events: ['a', 'b'],
  }

  it('creates a webhook when none is managed', () => {
    const plan = diff(dState({ webhook }), cState())
    expect(find(plan, 'create_webhook')!.url).toBe(webhook.url)
  })

  it('updates a webhook when the url changes', () => {
    const plan = diff(
      dState({ webhook }),
      cState({
        webhook: {
          id: 'we_1',
          url: 'https://old.example.com/api/stripe/webhook',
          enabledEvents: ['a', 'b'],
        },
      }),
    )
    expect(find(plan, 'update_webhook')!.changes.map((c) => c.field)).toContain('url')
  })

  it('treats event order as insignificant', () => {
    const plan = diff(
      dState({ webhook }),
      cState({ webhook: { id: 'we_1', url: webhook.url, enabledEvents: ['b', 'a'] } }),
    )
    expect(kinds(plan)).not.toContain('update_webhook')
  })

  it('treats duplicate events as a no-op (set semantics)', () => {
    const plan = diff(
      dState({ webhook: { url: webhook.url, events: ['a', 'a', 'b'] } }),
      cState({ webhook: { id: 'we_1', url: webhook.url, enabledEvents: ['a', 'b'] } }),
    )
    expect(kinds(plan)).not.toContain('update_webhook')
  })

  it('still detects a genuinely different event set', () => {
    const plan = diff(
      dState({ webhook: { url: webhook.url, events: ['a', 'b', 'c'] } }),
      cState({ webhook: { id: 'we_1', url: webhook.url, enabledEvents: ['a', 'b'] } }),
    )
    expect(kinds(plan)).toContain('update_webhook')
  })
})

describe('diff — portal', () => {
  const portal: DesiredPortal = {
    cancellations: true,
    planSwitching: true,
    paymentMethodUpdate: true,
    invoiceHistory: true,
  }

  it('creates a portal configuration when none is managed', () => {
    const plan = diff(dState({ portal }), cState())
    expect(kinds(plan)).toContain('create_portal')
  })

  it('updates the portal when a setting changes', () => {
    const plan = diff(
      dState({ portal }),
      cState({ portal: { id: 'bpc_1', ...portal, cancellations: false } }),
    )
    expect(find(plan, 'update_portal')!.changes.map((c) => c.field)).toContain('cancellations')
  })

  it('refreshes the portal when the catalog changed even if settings are unchanged', () => {
    const plan = diff(
      dState({ products: [dProduct({ prices: [dPrice({ unitAmount: 3000 })] })], portal }),
      cState({ portal: { id: 'bpc_1', ...portal } }),
    )
    expect(kinds(plan)).toContain('replace_price')
    expect(kinds(plan)).toContain('update_portal')
  })

  it('leaves an unchanged portal alone when nothing else changed', () => {
    const plan = diff(dState({ portal }), cState({ portal: { id: 'bpc_1', ...portal } }))
    expect(plan.actions).toEqual([])
  })
})
