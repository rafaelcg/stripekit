import { defineConfig } from 'stripekit'

export default defineConfig({
  products: {
    pro: {
      name: 'Pro',
      description: 'For growing teams',
      prices: {
        monthly: { amount: 2000, currency: 'usd', interval: 'month' },
        yearly: { amount: 19200, currency: 'usd', interval: 'year' },
      },
      features: { projects: 'unlimited', seats: '5' },
    },
    starter: {
      name: 'Starter',
      description: 'For individuals',
      prices: {
        monthly: { amount: 0, currency: 'usd', interval: 'month' },
      },
      features: { projects: '3', seats: '1' },
    },
  },
})
