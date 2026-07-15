import Stripe from 'stripe'
import { StripekitError } from '../util/errors'

export type StripeMode = 'test' | 'live'

/** Infer whether a secret/restricted key targets live or test mode from its prefix. */
export function detectMode(secretKey: string): StripeMode {
  if (/^(sk|rk)_live_/.test(secretKey)) return 'live'
  if (/^(sk|rk)_test_/.test(secretKey)) return 'test'
  throw new StripekitError(
    'STRIPE_SECRET_KEY does not look like a Stripe secret key (expected sk_… or rk_…).',
    {
      hint: 'Copy the secret key from https://dashboard.stripe.com/apikeys (use a test key while developing).',
    },
  )
}

/**
 * Construct the Stripe client used for reconciliation. We keep the SDK's
 * default network retries (2, with backoff on 5xx/409/connection errors) but
 * handle 429 rate limits ourselves, since the SDK does not retry those.
 */
export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    maxNetworkRetries: 2,
    appInfo: { name: 'stripekit', url: 'https://github.com/rafaelcg/stripekit' },
  })
}
