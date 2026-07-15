/**
 * Retry a Stripe call on HTTP 429 with exponential backoff and jitter. The
 * stripe-node SDK retries 5xx/409/connection errors itself but explicitly does
 * NOT retry rate limits, so the reconciler has to.
 */
export async function withRateLimitRetry<T>(
  fn: () => Promise<T>,
  opts: { maxAttempts?: number } = {},
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 6
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (isRateLimitError(err) && attempt < maxAttempts - 1) {
        const backoff = Math.min(1000 * 2 ** attempt, 20_000) * (0.5 + Math.random())
        await sleep(backoff)
        continue
      }
      throw err
    }
  }
}

function isRateLimitError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'statusCode' in err &&
    (err as { statusCode?: unknown }).statusCode === 429
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
