/**
 * Tagging conventions that make reconciliation safe.
 *
 * `stripekit push` only ever reads and mutates objects that carry these tags.
 * Anything you created by hand in the Stripe dashboard is invisible to it and
 * will never be touched — that safety-by-construction is a core promise.
 */

/** Metadata key holding a product's / price's stable stripekit identity. */
export const META_KEY = 'stripekit_key'

/** Metadata key marking singletons (webhook endpoints, portal configs) as ours. */
export const META_MANAGED = 'stripekit_managed'

/** Prefix under which product feature entitlements are stored in metadata. */
export const FEATURE_PREFIX = 'stripekit_feature_'

/** Any metadata key with this prefix is reserved and stripped from user metadata. */
export const RESERVED_PREFIX = 'stripekit_'

/** Compose the stable key for a price from its product and price slugs. */
export function priceCompositeKey(productKey: string, priceKey: string): string {
  return `${productKey}_${priceKey}`
}

/** Serialize a feature value for storage in Stripe metadata (all strings). */
export function serializeFeatureValue(value: string | number | boolean): string {
  return typeof value === 'string' ? value : String(value)
}
