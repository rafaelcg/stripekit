import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createJiti } from 'jiti'
import { describe, expect, it } from 'vitest'
import type { StripekitConfig } from '../src/config/types'
import { validateConfig } from '../src/config/schema'
import { applyPlan } from '../src/reconciler/apply'
import { buildDesiredState } from '../src/reconciler/desired'
import { diff } from '../src/reconciler/diff'
import { pullConfig } from '../src/reconciler/pull'
import { readCurrentState } from '../src/reconciler/read-state'
import { createFakeStripe, type FakeState } from './fake-stripe'

const managedProduct = (over: Partial<FakeState['products'][number]> = {}) => ({
  id: 'prod_m',
  object: 'product' as const,
  active: true,
  name: 'Pro',
  description: null,
  metadata: { stripekit_key: 'pro' },
  default_price: null,
  ...over,
})

const managedPrice = (over: Partial<FakeState['prices'][number]> = {}) => ({
  id: 'price_m',
  object: 'price' as const,
  product: 'prod_m',
  active: true,
  currency: 'usd',
  unit_amount: 2000,
  recurring: { interval: 'month', interval_count: 1 },
  lookup_key: 'pro_monthly',
  nickname: null,
  tax_behavior: null,
  metadata: { stripekit_key: 'pro_monthly' },
  ...over,
})

describe('readCurrentState — tag filtering', () => {
  it('ignores products and prices not created by stripekit', async () => {
    const { stripe } = createFakeStripe({
      products: [
        managedProduct(),
        {
          id: 'prod_hand',
          object: 'product',
          active: true,
          name: 'Handmade',
          description: null,
          metadata: {},
          default_price: null,
        },
      ],
      prices: [
        managedPrice(),
        {
          // A hand-made price on the managed product WITH a lookup_key but no
          // stripekit metadata — must still be ignored (ownership is tag-only).
          id: 'price_hand',
          object: 'price',
          product: 'prod_m',
          active: true,
          currency: 'usd',
          unit_amount: 999,
          recurring: { interval: 'month', interval_count: 1 },
          lookup_key: 'pro_legacy',
          nickname: null,
          tax_behavior: null,
          metadata: {},
        },
      ],
    })

    const state = await readCurrentState(stripe)
    expect(state.products).toHaveLength(1)
    expect(state.products[0]!.key).toBe('pro')
    expect(state.products[0]!.prices.map((p) => p.key)).toEqual(['pro_monthly'])
  })
})

const fullConfig: StripekitConfig = {
  products: {
    pro: {
      name: 'Pro',
      description: 'Pro plan',
      prices: {
        monthly: { amount: 2000, currency: 'usd', interval: 'month' },
        yearly: { amount: 19200, currency: 'usd', interval: 'year' },
      },
      features: { seats: 5 },
    },
  },
  portal: { planSwitching: true },
  webhooks: { path: '/api/stripe/webhook' },
}

async function reconcile(stripe: Parameters<typeof applyPlan>[0], config: StripekitConfig) {
  const desired = buildDesiredState(config, { baseUrl: 'https://app.example.com' })
  const current = await readCurrentState(stripe)
  const plan = diff(desired, current)
  const outcome = await applyPlan(stripe, plan, current, desired)
  return { plan, outcome }
}

describe('applyPlan — end to end', () => {
  it('applies a full config and converges on re-run', async () => {
    const { stripe } = createFakeStripe()

    const first = await reconcile(stripe, fullConfig)
    expect(first.plan.actions.length).toBeGreaterThan(0)
    expect(first.outcome.envUpdates.STRIPE_WEBHOOK_SECRET).toMatch(/^whsec_/)
    expect(first.outcome.envUpdates.STRIPE_PORTAL_CONFIGURATION_ID).toMatch(/^bpc_/)

    // Second reconcile against the now-populated account must be a no-op.
    const desired = buildDesiredState(fullConfig, { baseUrl: 'https://app.example.com' })
    const converged = diff(desired, await readCurrentState(stripe))
    expect(converged.actions).toEqual([])
  })

  it('replaces a price on amount change, archives the old one, and re-converges', async () => {
    const { stripe, state } = createFakeStripe()
    await reconcile(stripe, fullConfig)

    const changed: StripekitConfig = structuredClone(fullConfig)
    changed.products.pro!.prices.monthly!.amount = 2500
    const second = await reconcile(stripe, changed)
    expect(second.plan.actions.some((a) => a.kind === 'replace_price')).toBe(true)

    // Exactly one active price carries the pro_monthly lookup key, at the new amount.
    const activeMonthly = state.prices.filter((p) => p.active && p.lookup_key === 'pro_monthly')
    expect(activeMonthly).toHaveLength(1)
    expect(activeMonthly[0]!.unit_amount).toBe(2500)
    // The old price is archived, not deleted.
    expect(state.prices.some((p) => !p.active && p.unit_amount === 2000)).toBe(true)

    const desired = buildDesiredState(changed, { baseUrl: 'https://app.example.com' })
    expect(diff(desired, await readCurrentState(stripe)).actions).toEqual([])
  })

  it('captures the webhook signing secret only from creation', async () => {
    const { stripe } = createFakeStripe()
    const first = await reconcile(stripe, fullConfig)
    expect(first.outcome.envUpdates.STRIPE_WEBHOOK_SECRET).toBeDefined()

    // A subsequent no-op reconcile should not surface a secret (none was created).
    const second = await reconcile(stripe, fullConfig)
    expect(second.outcome.appliedCount).toBe(0)
    expect(second.outcome.envUpdates.STRIPE_WEBHOOK_SECRET).toBeUndefined()
  })
})

describe('pullConfig — round trip', () => {
  it('emits config source that loads and validates', async () => {
    const { stripe } = createFakeStripe({
      products: [
        managedProduct({ metadata: { stripekit_key: 'pro', stripekit_feature_seats: '5' } }),
        {
          id: 'prod_hand',
          object: 'product',
          active: true,
          name: 'Starter Kit',
          description: 'Handmade',
          metadata: {},
          default_price: null,
        },
      ],
      prices: [
        managedPrice(),
        managedPrice({
          id: 'price_y',
          unit_amount: 19200,
          recurring: { interval: 'year', interval_count: 1 },
          lookup_key: 'pro_yearly',
          metadata: { stripekit_key: 'pro_yearly' },
        }),
        {
          id: 'price_hand',
          object: 'price',
          product: 'prod_hand',
          active: true,
          currency: 'usd',
          unit_amount: 4900,
          recurring: null,
          lookup_key: null,
          nickname: null,
          tax_behavior: null,
          metadata: {},
        },
      ],
    })

    const result = await pullConfig(stripe)
    expect(result.productCount).toBe(2)
    expect(result.priceCount).toBe(3)

    // The generated source is valid TypeScript and a structurally valid config.
    const dir = mkdtempSync(join(tmpdir(), 'stripekit-pull-'))
    const file = join(dir, 'stripe.config.ts')
    const standalone = result.source.replace(
      "import { defineConfig } from 'stripekit'",
      'const defineConfig = (c) => c',
    )
    writeFileSync(file, standalone)

    const jiti = createJiti(pathToFileURL(file).href)
    const mod = await jiti.import(file, { default: true })
    const config = validateConfig(mod)
    expect(Object.keys(config.products).sort()).toEqual(['pro', 'starter_kit'])
    expect(config.products.pro!.features).toEqual({ seats: '5' })
  })

  it('skips products whose only prices are unrepresentable, with a warning', async () => {
    const { stripe } = createFakeStripe({
      products: [
        managedProduct(),
        {
          id: 'prod_tier',
          object: 'product',
          active: true,
          name: 'Tiered',
          description: null,
          metadata: {},
          default_price: null,
        },
      ],
      prices: [
        managedPrice(),
        {
          // Tiered / decimal price: unit_amount is null and can't be represented.
          id: 'price_tier',
          object: 'price',
          product: 'prod_tier',
          active: true,
          currency: 'usd',
          unit_amount: null,
          recurring: { interval: 'month', interval_count: 1 },
          lookup_key: null,
          nickname: null,
          tax_behavior: null,
          metadata: {},
        },
      ],
    })

    const result = await pullConfig(stripe)
    expect(result.productCount).toBe(1) // Tiered dropped (no representable price)
    expect(result.priceCount).toBe(1)
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.source).not.toContain('prices: {\n      },') // never emits an empty prices block
  })

  it('round-trips tax_behavior', async () => {
    const { stripe } = createFakeStripe({
      products: [managedProduct()],
      prices: [managedPrice({ tax_behavior: 'exclusive' })],
    })
    const result = await pullConfig(stripe)
    expect(result.source).toContain("taxBehavior: 'exclusive'")
  })
})

describe('applyPlan — one-time catalog convergence', () => {
  it('converges with a one-time-only catalog and a plan-switching portal', async () => {
    const { stripe } = createFakeStripe()
    const config: StripekitConfig = {
      products: {
        lifetime: { name: 'Lifetime', prices: { once: { amount: 9900, currency: 'usd' } } },
      },
      portal: { planSwitching: true },
    }
    const desired = buildDesiredState(config)
    const current = await readCurrentState(stripe)
    await applyPlan(stripe, diff(desired, current), current, desired)
    // planSwitching stays enabled with no switchable products; must still converge.
    expect(diff(desired, await readCurrentState(stripe)).actions).toEqual([])
  })
})
