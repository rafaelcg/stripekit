import { defineConfig } from 'stripekit'

/**
 * Your Stripe catalog, as code. Run `stripekit plan` to preview changes and
 * `stripekit push` to reconcile your Stripe account to match this file.
 */
export default defineConfig({
  products: {
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

  portal: { cancellations: true, planSwitching: true },
  webhooks: { path: '/api/stripe/webhook' },
})
