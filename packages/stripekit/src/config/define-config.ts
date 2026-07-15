import type { StripekitConfig } from './types'

/**
 * Identity helper that gives you full type-checking and autocomplete when
 * authoring `stripe.config.ts`:
 *
 * ```ts
 * import { defineConfig } from 'stripekit'
 *
 * export default defineConfig({
 *   products: {
 *     pro: {
 *       name: 'Pro',
 *       prices: { monthly: { amount: 2000, currency: 'usd', interval: 'month' } },
 *       features: { seats: 5 },
 *     },
 *   },
 * })
 * ```
 */
export function defineConfig(config: StripekitConfig): StripekitConfig {
  return config
}
