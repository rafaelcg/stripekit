import { spawn } from 'node:child_process'
import { relative } from 'node:path'
import pc from 'picocolors'
import { DEFAULT_WEBHOOK_EVENTS, ENV } from '../../constants'
import { findConfigPath, loadConfig } from '../../config/load'
import { detectMode, type StripeMode } from '../../stripe/client'
import { StripekitError } from '../../util/errors'
import { chooseEnvFile, resolveEnvVar, upsertEnv } from '../../util/env'

export interface DevOptions {
  cwd: string
  port?: number
  path?: string
  forwardTo?: string
  /** Comma-separated event override. */
  events?: string
  /** Forward every event type instead of the handler's set. */
  allEvents?: boolean
}

/** Build the local forward URL for `stripe listen --forward-to`. */
export function resolveForwardUrl(opts: {
  forwardTo?: string
  port?: number
  path: string
}): string {
  if (opts.forwardTo) return opts.forwardTo
  const path = opts.path.startsWith('/') ? opts.path : `/${opts.path}`
  return `localhost:${opts.port ?? 3000}${path}`
}

/** Assemble the `stripe listen` argument list (the API key is passed via env, not argv). */
export function buildListenArgs(opts: { forwardTo: string; events: string[] | null }): string[] {
  const args = ['listen', '--forward-to', opts.forwardTo]
  if (opts.events && opts.events.length) args.push('--events', opts.events.join(','))
  return args
}

/** Extract the webhook signing secret from a line of `stripe listen` output. */
export function extractWebhookSecret(text: string): string | null {
  const match = text.match(/whsec_[A-Za-z0-9]+/)
  return match ? match[0] : null
}

export async function runDev(opts: DevOptions): Promise<void> {
  const secretKey = resolveEnvVar(opts.cwd, ENV.secretKey)
  if (!secretKey) {
    throw new StripekitError(
      'No STRIPE_SECRET_KEY found in the environment or .env / .env.local.',
      {
        hint: 'Add STRIPE_SECRET_KEY=sk_test_… to .env.local, or run `stripekit init`.',
      },
    )
  }
  const mode = detectMode(secretKey)

  let webhookPath = opts.path ?? '/api/stripe/webhook'
  let events: string[] | null = [...DEFAULT_WEBHOOK_EVENTS]
  if (findConfigPath(opts.cwd)) {
    const { config } = await loadConfig(opts.cwd)
    if (!opts.path) webhookPath = config.webhooks?.path ?? webhookPath
    if (config.webhooks?.events) events = [...config.webhooks.events]
  }
  if (opts.events)
    events = opts.events
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean)
  if (opts.allEvents) events = null

  const forwardTo = resolveForwardUrl({
    forwardTo: opts.forwardTo,
    port: opts.port,
    path: webhookPath,
  })
  const args = buildListenArgs({ forwardTo, events })

  console.log(
    `${pc.bold('stripekit dev')} — forwarding ${modeLabel(mode)} webhooks → ${pc.cyan(forwardTo)}`,
  )
  console.log(pc.dim('Press Ctrl-C to stop.\n'))

  await runListen(opts.cwd, secretKey, args)
}

function runListen(cwd: string, apiKey: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    // The Stripe CLI reads STRIPE_API_KEY from the env, so the key never appears
    // in the process list (unlike passing --api-key on argv).
    const child = spawn('stripe', args, {
      cwd,
      env: { ...process.env, STRIPE_API_KEY: apiKey },
      stdio: ['inherit', 'pipe', 'pipe'],
    })

    let wroteSecret = false
    const captureSecret = (text: string) => {
      if (wroteSecret) return
      const secret = extractWebhookSecret(text)
      if (!secret) return
      wroteSecret = true
      const envPath = chooseEnvFile(cwd)
      upsertEnv(envPath, { STRIPE_WEBHOOK_SECRET: secret })
      console.log(
        pc.green(
          `\n✓ Wrote STRIPE_WEBHOOK_SECRET (local) to ${relative(cwd, envPath) || envPath} — restart your dev server if it's already running.\n`,
        ),
      )
    }

    child.stdout.on('data', (buf: Buffer) => {
      const text = buf.toString()
      process.stdout.write(text)
      captureSecret(text)
    })
    child.stderr.on('data', (buf: Buffer) => {
      const text = buf.toString()
      process.stderr.write(text)
      captureSecret(text)
    })

    child.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(
          new StripekitError('The Stripe CLI is required for `stripekit dev`, but was not found.', {
            hint: 'Install it from https://docs.stripe.com/stripe-cli (macOS: brew install stripe/stripe-cli/stripe), then re-run.',
          }),
        )
      } else {
        reject(err)
      }
    })

    // Let Ctrl-C stop the child; we resolve when it exits.
    const onSigint = () => child.kill('SIGINT')
    process.on('SIGINT', onSigint)
    child.on('exit', (code) => {
      process.off('SIGINT', onSigint)
      if (code && code !== 0 && code !== 130) {
        reject(new StripekitError(`stripe listen exited with code ${code}.`))
      } else {
        resolve()
      }
    })
  })
}

function modeLabel(mode: StripeMode): string {
  return mode === 'live' ? pc.red(pc.bold('LIVE')) : pc.cyan('test')
}
