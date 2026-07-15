import type Stripe from 'stripe'
import { ENV } from '../constants'
import { createStripeClient, detectMode, type StripeMode } from '../stripe/client'
import { StripekitError } from '../util/errors'
import { resolveEnvVar } from '../util/env'

export interface CliContext {
  cwd: string
  stripe: Stripe
  mode: StripeMode
}

/** Build the Stripe client for a command, resolving the secret key from env/.env. */
export function createContext(cwd: string): CliContext {
  const secretKey = resolveEnvVar(cwd, ENV.secretKey)
  if (!secretKey) {
    throw new StripekitError(
      'No STRIPE_SECRET_KEY found in the environment or .env / .env.local.',
      {
        hint: 'Add STRIPE_SECRET_KEY=sk_test_… to .env.local, or run `stripekit init`.',
      },
    )
  }
  return { cwd, stripe: createStripeClient(secretKey), mode: detectMode(secretKey) }
}
