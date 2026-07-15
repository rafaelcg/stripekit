import { cancel, intro, isCancel, log, note, outro, select, text } from '@clack/prompts'
import pc from 'picocolors'
import { ENV } from '../../constants'
import { loadConfig } from '../../config/load'
import { chooseEnvFile, resolveEnvVar, upsertEnv } from '../../util/env'
import {
  detectProject,
  installCommand,
  type AuthLibrary,
  type SyncAdapter,
} from '../../init/detect'
import {
  requiredEnv,
  requiredPackages,
  writeScaffold,
  writeStarterConfig,
  type ScaffoldOptions,
} from '../../init/scaffold'

export interface InitOptions {
  cwd: string
  adapter?: SyncAdapter
  auth?: AuthLibrary
  yes?: boolean
}

const AUTH_LABEL: Record<AuthLibrary, string> = {
  clerk: 'Clerk',
  authjs: 'Auth.js (NextAuth v5)',
  'better-auth': 'better-auth',
  none: 'none detected',
}

export async function runInit(opts: InitOptions): Promise<void> {
  const project = detectProject(opts.cwd)
  const interactive = !opts.yes && process.stdin.isTTY && process.stdout.isTTY

  intro(pc.bold('stripekit init'))

  // Code scaffolding targets Next.js App Router. For any other stack, still set
  // up the declarative catalog so plan/push/pull work.
  if (!project.isNext) {
    return runConfigOnlyInit(project, opts, interactive)
  }

  const adapter = await resolveAdapter(opts, interactive)
  const auth = opts.auth ?? project.auth
  log.info(
    `Framework: ${pc.cyan('Next.js App Router')}  ·  Auth: ${pc.cyan(AUTH_LABEL[auth])}  ·  State: ${pc.cyan(adapter)}`,
  )

  // Ensure a config exists, then read the webhook path from it.
  const configWritten = writeStarterConfig(project)
  const { config } = await loadConfig(opts.cwd)
  const webhookPath = config.webhooks?.path ?? '/api/stripe/webhook'

  const scaffoldOpts: ScaffoldOptions = { adapter, auth, webhookPath }
  const result = writeScaffold(project, scaffoldOpts)

  // Report what changed.
  const created = [configWritten, ...result.written].filter(Boolean) as string[]
  if (created.length)
    log.success(`Created:\n${created.map((f) => `  ${pc.green('+')} ${f}`).join('\n')}`)
  if (result.skipped.length) {
    log.warn(
      `Skipped (already exist):\n${result.skipped.map((f) => `  ${pc.dim('•')} ${f}`).join('\n')}`,
    )
  }

  // Make sure a secret key is available (prompt if interactive and missing).
  await ensureSecretKey(opts.cwd, interactive)

  note(nextSteps(project, scaffoldOpts, auth), 'Next steps')
  outro(pc.green('Done. Run `stripekit push` to create your products, webhook, and portal.'))
}

/**
 * For non-Next.js projects: set up the declarative catalog (stripe.config.ts) so
 * plan/push/pull work, and point the user there. Billing-code scaffolding is
 * Next.js App Router-only for now.
 */
async function runConfigOnlyInit(
  project: ReturnType<typeof detectProject>,
  opts: InitOptions,
  interactive: boolean,
): Promise<void> {
  log.info(
    `No Next.js app detected — setting up ${pc.cyan('catalog reconciliation')}. Code scaffolding is Next.js-only for now.`,
  )

  const configWritten = writeStarterConfig(project)
  if (configWritten) log.success(`Created ${pc.green('+')} ${configWritten}`)
  else log.warn('stripe.config.ts already exists — leaving it untouched.')

  await ensureSecretKey(opts.cwd, interactive)

  note(
    [
      `1. Edit ${pc.cyan('stripe.config.ts')} to describe your products and prices.`,
      `2. Preview:  ${pc.cyan('npx stripekit plan')}`,
      `3. Apply:    ${pc.cyan('npx stripekit push')}`,
    ].join('\n'),
    'Next steps',
  )
  outro(pc.green('Done. Your catalog is ready — reconcile it with `stripekit push`.'))
}

async function resolveAdapter(opts: InitOptions, interactive: boolean): Promise<SyncAdapter> {
  if (opts.adapter) return opts.adapter
  if (!interactive) return 'kv'
  const choice = await select({
    message: 'Where should synced customer state live?',
    options: [
      { value: 'kv', label: 'KV / Redis (Upstash)', hint: 'self-contained — great to start' },
      { value: 'drizzle', label: 'Postgres (Drizzle)', hint: 'a stripe_customers table' },
    ],
  })
  if (isCancel(choice)) {
    cancel('Aborted.')
    process.exit(0)
  }
  return choice as SyncAdapter
}

async function ensureSecretKey(cwd: string, interactive: boolean): Promise<void> {
  if (resolveEnvVar(cwd, ENV.secretKey)) return
  if (!interactive) {
    log.warn('No STRIPE_SECRET_KEY found — add it to .env.local before running `stripekit push`.')
    return
  }
  const entered = await text({
    message: 'Paste your Stripe test secret key (or leave blank to add later)',
    placeholder: 'sk_test_...',
    validate: (value) =>
      value && !/^(sk|rk)_test_/.test(value)
        ? 'Use a test key (sk_test_…) while developing'
        : undefined,
  })
  if (isCancel(entered) || !entered) {
    log.warn('Add STRIPE_SECRET_KEY to .env.local before running `stripekit push`.')
    return
  }
  const envPath = chooseEnvFile(cwd)
  upsertEnv(envPath, { STRIPE_SECRET_KEY: entered })
  log.success(`Saved STRIPE_SECRET_KEY to ${envPath.split('/').pop()}`)
}

function nextSteps(
  project: ReturnType<typeof detectProject>,
  opts: ScaffoldOptions,
  auth: AuthLibrary,
): string {
  const lines: string[] = []

  const packages = requiredPackages(opts)
  lines.push(
    `1. Install dependencies:\n   ${pc.cyan(installCommand(project.packageManager, packages))}`,
  )

  lines.push(
    `2. Set these env vars in .env.local:\n${requiredEnv(opts)
      .map((e) => `   ${pc.dim('-')} ${e}`)
      .join('\n')}`,
  )

  lines.push(
    `3. Reconcile your Stripe account:\n   ${pc.cyan('npx stripekit push')}\n   (writes STRIPE_WEBHOOK_SECRET and STRIPE_PORTAL_CONFIGURATION_ID back to .env)`,
  )

  let step = 4
  if (auth === 'clerk' || auth === 'authjs') {
    lines.push(
      `${step++}. Make the webhook route public in your middleware — Stripe must reach ${opts.webhookPath} unauthenticated.`,
    )
  }
  if (auth === 'authjs') {
    lines.push(
      `${step++}. Populate session.user.id in your Auth.js callbacks (see lib/stripe/auth.ts).`,
    )
  }
  if (auth === 'none') {
    lines.push(`${step++}. Implement getUserId() in lib/stripe/auth.ts — it currently throws.`)
  }
  if (opts.adapter === 'drizzle') {
    lines.push(`${step++}. Run your Drizzle migration to create the stripe_customers table.`)
  }

  lines.push(
    `${step}. Wire your UI: POST { lookupKey } to /api/stripe/checkout, and POST to /api/stripe/portal.`,
  )

  return lines.join('\n\n')
}
