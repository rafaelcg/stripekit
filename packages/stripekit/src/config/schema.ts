import { z } from 'zod'
import { StripekitError } from '../util/errors'
import type { StripekitConfig } from './types'

/** Keys become Stripe `lookup_key`s and metadata values, so keep them clean. */
const keySchema = z
  .string()
  .regex(
    /^[a-z][a-z0-9_]*$/,
    'must be lowercase, start with a letter, and contain only letters, numbers, and underscores',
  )

const featureValueSchema = z.union([z.string(), z.number(), z.boolean()])

const priceSchema = z
  .object({
    amount: z
      .number()
      .int('amount must be an integer number of minor units (e.g. cents)')
      .nonnegative(),
    currency: z
      .string()
      .length(3, 'currency must be a 3-letter ISO-4217 code, e.g. "usd"')
      .transform((c) => c.toLowerCase()),
    interval: z.enum(['day', 'week', 'month', 'year']).optional(),
    intervalCount: z.number().int().positive().optional(),
    nickname: z.string().optional(),
    taxBehavior: z.enum(['inclusive', 'exclusive', 'unspecified']).optional(),
  })
  .strict()

const productSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().optional(),
    prices: z.record(keySchema, priceSchema).refine((p) => Object.keys(p).length > 0, {
      message: 'a product must define at least one price',
    }),
    features: z.record(z.string(), featureValueSchema).optional(),
    active: z.boolean().optional(),
    metadata: z.record(z.string(), z.string()).optional(),
  })
  .strict()

const webhookSchema = z
  .object({
    path: z.string().startsWith('/', 'webhook path must start with "/"'),
    events: z.array(z.string()).optional(),
  })
  .strict()

const portalSchema = z
  .object({
    cancellations: z.boolean().optional(),
    planSwitching: z.boolean().optional(),
    paymentMethodUpdate: z.boolean().optional(),
    invoiceHistory: z.boolean().optional(),
  })
  .strict()

const configSchema = z
  .object({
    products: z.record(keySchema, productSchema).refine((p) => Object.keys(p).length > 0, {
      message: 'config must define at least one product',
    }),
    webhooks: webhookSchema.optional(),
    portal: z.union([portalSchema, z.literal(false)]).optional(),
    sync: z
      .object({ adapter: z.enum(['drizzle', 'kv', 'prisma']) })
      .strict()
      .optional(),
  })
  .strict()

/**
 * Validate a loaded config object, throwing a formatted {@link StripekitError}
 * with every problem listed if it doesn't match the schema.
 */
export function validateConfig(input: unknown): StripekitConfig {
  const result = configSchema.safeParse(input)
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => {
        const path = issue.path.length ? issue.path.join('.') : '(root)'
        return `  • ${path}: ${issue.message}`
      })
      .join('\n')
    throw new StripekitError(`Invalid stripe.config.ts:\n${issues}`, {
      hint: 'See https://rafaelcg.github.io/stripekit/config for the full schema.',
    })
  }
  return result.data as StripekitConfig
}
