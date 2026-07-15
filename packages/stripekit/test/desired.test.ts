import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_WEBHOOK_EVENTS } from '../src/constants'
import type { StripekitConfig } from '../src/config/types'
import { buildDesiredState, joinUrl } from '../src/reconciler/desired'
import { formatMoney } from '../src/reconciler/plan'
import { canonicalJson, stableIdempotencyKey } from '../src/util/hash'
import { readEnvFile, resolveEnvVar, upsertEnv } from '../src/util/env'

const baseConfig = (over: Partial<StripekitConfig> = {}): StripekitConfig => ({
  products: {
    pro: {
      name: 'Pro',
      prices: {
        monthly: { amount: 2000, currency: 'USD', interval: 'month' },
        yearly: { amount: 19200, currency: 'usd', interval: 'year' },
      },
      features: { seats: 5, unlimited: true },
    },
  },
  ...over,
})

describe('buildDesiredState', () => {
  it('derives composite price keys, sorted, with normalized currency', () => {
    const state = buildDesiredState(baseConfig())
    const product = state.products[0]!
    expect(product.key).toBe('pro')
    expect(product.prices.map((p) => p.key)).toEqual(['pro_monthly', 'pro_yearly'])
    expect(product.prices[0]!.currency).toBe('usd')
  })

  it('serializes feature values to strings', () => {
    const product = buildDesiredState(baseConfig()).products[0]!
    expect(product.features).toEqual({ seats: '5', unlimited: 'true' })
  })

  it('strips reserved metadata keys from user metadata', () => {
    const config = baseConfig()
    config.products.pro!.metadata = { stripekit_key: 'nope', team: 'growth' }
    const product = buildDesiredState(config).products[0]!
    expect(product.userMetadata).toEqual({ team: 'growth' })
  })

  it('resolves the webhook URL only when a base URL is available', () => {
    const config = baseConfig({ webhooks: { path: '/api/stripe/webhook' } })
    expect(buildDesiredState(config).webhook).toBeNull()
    const resolved = buildDesiredState(config, { baseUrl: 'https://app.example.com' }).webhook
    expect(resolved).toEqual({
      url: 'https://app.example.com/api/stripe/webhook',
      events: [...DEFAULT_WEBHOOK_EVENTS],
    })
  })

  it('applies portal defaults and honors an explicit disable', () => {
    expect(buildDesiredState(baseConfig()).portal).toBeNull()
    expect(buildDesiredState(baseConfig({ portal: false })).portal).toBeNull()
    expect(buildDesiredState(baseConfig({ portal: {} })).portal).toEqual({
      cancellations: true,
      planSwitching: true,
      paymentMethodUpdate: true,
      invoiceHistory: true,
    })
    expect(
      buildDesiredState(baseConfig({ portal: { planSwitching: false } })).portal?.planSwitching,
    ).toBe(false)
  })
})

describe('buildDesiredState — collision detection', () => {
  it('throws when two prices produce the same composite lookup key', () => {
    expect(() =>
      buildDesiredState({
        products: {
          pro: { name: 'Pro', prices: { monthly_eur: { amount: 2000, currency: 'eur' } } },
          pro_monthly: { name: 'Pro Monthly', prices: { eur: { amount: 2000, currency: 'eur' } } },
        },
      }),
    ).toThrow(/same lookup key/)
  })
})

describe('joinUrl', () => {
  it('joins base and path, trimming and adding scheme', () => {
    expect(joinUrl('https://a.com/', '/x')).toBe('https://a.com/x')
    expect(joinUrl('a.com', 'x')).toBe('https://a.com/x')
  })
})

describe('formatMoney', () => {
  it('formats recurring and one-time prices', () => {
    expect(
      formatMoney({ unitAmount: 2000, currency: 'usd', interval: 'month', intervalCount: 1 }),
    ).toBe('20.00 USD / month')
    expect(
      formatMoney({ unitAmount: 2000, currency: 'usd', interval: null, intervalCount: 1 }),
    ).toBe('20.00 USD one-time')
    expect(
      formatMoney({ unitAmount: 500, currency: 'eur', interval: 'month', intervalCount: 3 }),
    ).toBe('5.00 EUR / 3 months')
  })
})

describe('stableIdempotencyKey', () => {
  it('is deterministic and key-order independent', () => {
    const a = stableIdempotencyKey('create_price', 'pro_monthly', { a: 1, b: 2 })
    const b = stableIdempotencyKey('create_price', 'pro_monthly', { b: 2, a: 1 })
    expect(a).toBe(b)
    expect(a.startsWith('stripekit:create_price:pro_monthly:')).toBe(true)
  })

  it('changes when params change', () => {
    const a = stableIdempotencyKey('create_price', 'pro_monthly', { amount: 2000 })
    const b = stableIdempotencyKey('create_price', 'pro_monthly', { amount: 2500 })
    expect(a).not.toBe(b)
  })

  it('canonicalJson sorts nested keys', () => {
    expect(canonicalJson({ b: 1, a: { d: 4, c: 3 } })).toBe('{"a":{"c":3,"d":4},"b":1}')
  })
})

describe('env utilities', () => {
  it('upserts keys while preserving existing lines and comments', () => {
    const dir = mkdtempSync(join(tmpdir(), 'stripekit-env-'))
    const file = join(dir, '.env.local')
    writeFileSync(file, '# comment\nEXISTING=1\nSTRIPE_WEBHOOK_SECRET=old\n')

    const result = upsertEnv(file, {
      STRIPE_WEBHOOK_SECRET: 'whsec_new',
      STRIPE_PORTAL_CONFIGURATION_ID: 'bpc_1',
    })
    expect(result.updated).toEqual(['STRIPE_WEBHOOK_SECRET'])
    expect(result.added).toEqual(['STRIPE_PORTAL_CONFIGURATION_ID'])

    const content = readFileSync(file, 'utf8')
    expect(content).toContain('# comment')
    expect(content).toContain('EXISTING=1')
    expect(content).toContain('STRIPE_WEBHOOK_SECRET=whsec_new')
    expect(content).toContain('STRIPE_PORTAL_CONFIGURATION_ID=bpc_1')

    expect(readEnvFile(file).STRIPE_WEBHOOK_SECRET).toBe('whsec_new')
  })

  it('reports unchanged keys without rewriting them', () => {
    const dir = mkdtempSync(join(tmpdir(), 'stripekit-env-'))
    const file = join(dir, '.env')
    writeFileSync(file, 'STRIPE_WEBHOOK_SECRET=whsec_x\n')
    expect(upsertEnv(file, { STRIPE_WEBHOOK_SECRET: 'whsec_x' }).unchanged).toEqual([
      'STRIPE_WEBHOOK_SECRET',
    ])
  })

  it('resolves variables with process.env taking precedence over files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'stripekit-env-'))
    writeFileSync(join(dir, '.env'), 'STRIPE_SECRET_KEY=sk_test_from_file\n')
    expect(resolveEnvVar(dir, ['STRIPE_SECRET_KEY'])).toBe('sk_test_from_file')
  })
})
