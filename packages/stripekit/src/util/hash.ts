import { createHash } from 'node:crypto'

/**
 * Build a stable idempotency key from an operation, a resource identity, and a
 * hash of the exact params. Retrying an identical operation replays Stripe's
 * cached result (safe after a crash mid-apply); a genuine spec change hashes to
 * a new key, avoiding Stripe's "same key, different params" 400.
 */
export function stableIdempotencyKey(op: string, identity: string, params: unknown): string {
  const digest = createHash('sha256').update(canonicalJson(params)).digest('hex').slice(0, 16)
  return `stripekit:${op}:${identity}:${digest}`
}

/** Deterministic JSON with recursively sorted object keys. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value))
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortKeys((value as Record<string, unknown>)[key])
    }
    return out
  }
  return value
}
