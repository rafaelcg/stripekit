import { defineConfig } from 'stripekit'

/**
 * Your Stripe catalog, as code. Run `stripekit plan` to preview changes and
 * `stripekit push` to reconcile your Stripe account to match this file. The
 * same config targets test and live mode — `push --live` promotes it.
 */
export default defineConfig({
  products: {
    starter: {
      name: 'Starter',
      description: 'For individuals getting started',
      prices: {
        monthly: { amount: 0, currency: 'usd', interval: 'month' },
      },
      features: { seats: 1, projects: 3 },
    },

    pro: {
      name: 'Pro',
      description: 'For growing teams',
      prices: {
        monthly: { amount: 2000, currency: 'usd', interval: 'month' },
        yearly: { amount: 19200, currency: 'usd', interval: 'year' },
      },
      features: { seats: 5, projects: 'unlimited' },
    },
  },

  // Registered when a deployment URL is available (--url or NEXT_PUBLIC_APP_URL).
  // For local development, use `stripekit dev` to forward events instead.
  webhooks: { path: '/api/stripe/webhook' },

  // Managed customer portal. Set to `false` to leave the portal unmanaged.
  portal: { cancellations: true, planSwitching: true },
})
