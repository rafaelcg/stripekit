/**
 * A user-facing error. The CLI prints `message` without a stack trace; anything
 * else that throws is treated as an unexpected bug and printed with its stack.
 */
export class StripekitError extends Error {
  readonly hint?: string

  constructor(message: string, options?: { hint?: string; cause?: unknown }) {
    super(message, { cause: options?.cause })
    this.name = 'StripekitError'
    this.hint = options?.hint
  }
}

export function isStripekitError(err: unknown): err is StripekitError {
  return err instanceof StripekitError
}
