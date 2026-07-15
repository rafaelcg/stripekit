import { describe, expect, it } from 'vitest'
import { evaluateChecks, type CheckFacts } from '../src/cli/commands/check'

const facts = (over: Partial<CheckFacts> = {}): CheckFacts => ({
  hasKey: true,
  keyMode: 'test',
  keyValid: true,
  accountId: 'acct_123',
  configFound: true,
  configError: null,
  productCount: 2,
  pendingChanges: 0,
  webhookConfigured: true,
  webhookRegistered: true,
  webhookSecretPresent: true,
  baseUrlResolved: true,
  portalConfigured: true,
  portalRegistered: true,
  portalIdPresent: true,
  ...over,
})

const byLabel = (items: ReturnType<typeof evaluateChecks>, label: string) =>
  items.find((i) => i.label.startsWith(label))

describe('evaluateChecks', () => {
  it('fails fast with no key', () => {
    const items = evaluateChecks(facts({ hasKey: false }))
    expect(items).toHaveLength(1)
    expect(items[0]!.status).toBe('fail')
  })

  it('fails on a malformed key', () => {
    const items = evaluateChecks(facts({ keyMode: null }))
    expect(items.at(-1)!.status).toBe('fail')
  })

  it('fails on an invalid (rejected) key', () => {
    const items = evaluateChecks(facts({ keyValid: false }))
    expect(items.at(-1)!.detail).toMatch(/rejected/)
  })

  it('fails when the config is missing', () => {
    const items = evaluateChecks(facts({ configFound: false }))
    expect(byLabel(items, 'Stripe key')!.status).toBe('ok')
    expect(byLabel(items, 'stripe.config.ts')!.status).toBe('fail')
  })

  it('surfaces a config load error', () => {
    const items = evaluateChecks(facts({ configError: 'Invalid stripe.config.ts: ...' }))
    expect(byLabel(items, 'stripe.config.ts')!.status).toBe('fail')
  })

  it('reports all green when everything is set up and in sync', () => {
    const items = evaluateChecks(facts())
    expect(items.every((i) => i.status === 'ok')).toBe(true)
    expect(byLabel(items, 'Config vs. account')!.detail).toBe('in sync')
  })

  it('warns on pending drift', () => {
    const items = evaluateChecks(facts({ pendingChanges: 3 }))
    const drift = byLabel(items, 'Config vs. account')!
    expect(drift.status).toBe('warn')
    expect(drift.detail).toMatch(/3 pending/)
  })

  it('warns when the webhook is registered but the secret is missing', () => {
    const items = evaluateChecks(facts({ webhookSecretPresent: false }))
    expect(byLabel(items, 'Webhook endpoint')!.status).toBe('warn')
  })

  it('warns when the webhook is configured but not registered', () => {
    const items = evaluateChecks(facts({ webhookRegistered: false, baseUrlResolved: false }))
    const wh = byLabel(items, 'Webhook endpoint')!
    expect(wh.status).toBe('warn')
    expect(wh.detail).toMatch(/no deployment URL/)
  })

  it('warns when the portal is registered but the id is missing', () => {
    const items = evaluateChecks(facts({ portalIdPresent: false }))
    expect(byLabel(items, 'Customer portal')!.status).toBe('warn')
  })

  it('omits webhook/portal rows when neither configured nor registered', () => {
    const items = evaluateChecks(
      facts({
        webhookConfigured: false,
        webhookRegistered: false,
        portalConfigured: false,
        portalRegistered: false,
      }),
    )
    expect(byLabel(items, 'Webhook endpoint')).toBeUndefined()
    expect(byLabel(items, 'Customer portal')).toBeUndefined()
  })
})
