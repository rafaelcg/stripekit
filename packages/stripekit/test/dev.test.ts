import { describe, expect, it } from 'vitest'
import { buildListenArgs, extractWebhookSecret, resolveForwardUrl } from '../src/cli/commands/dev'

describe('resolveForwardUrl', () => {
  it('builds a localhost URL from port and path', () => {
    expect(resolveForwardUrl({ path: '/api/stripe/webhook' })).toBe(
      'localhost:3000/api/stripe/webhook',
    )
    expect(resolveForwardUrl({ path: '/api/stripe/webhook', port: 4000 })).toBe(
      'localhost:4000/api/stripe/webhook',
    )
  })

  it('normalizes a path missing its leading slash', () => {
    expect(resolveForwardUrl({ path: 'hooks' })).toBe('localhost:3000/hooks')
  })

  it('prefers an explicit forwardTo', () => {
    expect(
      resolveForwardUrl({ path: '/x', port: 3000, forwardTo: 'https://tunnel.example/api' }),
    ).toBe('https://tunnel.example/api')
  })
})

describe('buildListenArgs', () => {
  it('forwards to the target with no --events when events is null', () => {
    expect(buildListenArgs({ forwardTo: 'localhost:3000/api', events: null })).toEqual([
      'listen',
      '--forward-to',
      'localhost:3000/api',
    ])
  })

  it('passes a comma-joined --events list', () => {
    expect(buildListenArgs({ forwardTo: 'localhost:3000/api', events: ['a.b', 'c.d'] })).toEqual([
      'listen',
      '--forward-to',
      'localhost:3000/api',
      '--events',
      'a.b,c.d',
    ])
  })

  it('omits --events for an empty list', () => {
    expect(buildListenArgs({ forwardTo: 'x', events: [] })).toEqual(['listen', '--forward-to', 'x'])
  })
})

describe('extractWebhookSecret', () => {
  it('pulls the secret out of the stripe listen ready line', () => {
    const line = '> Ready! Your webhook signing secret is whsec_abc123DEF456 (^C to quit)'
    expect(extractWebhookSecret(line)).toBe('whsec_abc123DEF456')
  })

  it('returns null when no secret is present', () => {
    expect(extractWebhookSecret('2024-... --> charge.succeeded [evt_1]')).toBeNull()
  })
})
