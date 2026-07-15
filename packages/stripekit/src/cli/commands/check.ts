import pc from 'picocolors'
import { ENV } from '../../constants'
import { findConfigPath, loadConfig } from '../../config/load'
import { buildDesiredState } from '../../reconciler/desired'
import { diff } from '../../reconciler/diff'
import { readCurrentState } from '../../reconciler/read-state'
import { createStripeClient, detectMode, type StripeMode } from '../../stripe/client'
import { resolveEnvVar } from '../../util/env'

export type CheckStatus = 'ok' | 'warn' | 'fail'

export interface CheckItem {
  label: string
  status: CheckStatus
  detail?: string
}

export interface CheckOptions {
  cwd: string
  json?: boolean
  url?: string
}

/** Everything runCheck gathers from the environment, Stripe, and the config. */
export interface CheckFacts {
  hasKey: boolean
  keyMode: StripeMode | null // null = key present but malformed
  keyValid: boolean | null // null = not tested
  accountId?: string
  configFound: boolean
  configError: string | null
  productCount: number | null
  pendingChanges: number | null // null = not reached
  webhookConfigured: boolean
  webhookRegistered: boolean
  webhookUrl?: string
  webhookSecretPresent: boolean
  baseUrlResolved: boolean
  portalConfigured: boolean
  portalRegistered: boolean
  portalIdPresent: boolean
}

/** Pure: turn gathered facts into a checklist. Order matters (most fundamental first). */
export function evaluateChecks(f: CheckFacts): CheckItem[] {
  const items: CheckItem[] = []

  if (!f.hasKey) {
    items.push({
      label: 'Stripe secret key',
      status: 'fail',
      detail: 'STRIPE_SECRET_KEY not found in env or .env(.local)',
    })
    return items
  }
  if (f.keyMode === null) {
    items.push({
      label: 'Stripe secret key',
      status: 'fail',
      detail: 'does not look like a Stripe key (expected sk_… or rk_…)',
    })
    return items
  }
  if (f.keyValid === false) {
    items.push({
      label: `Stripe key (${f.keyMode} mode)`,
      status: 'fail',
      detail: 'rejected by Stripe — key is invalid or revoked',
    })
    return items
  }
  items.push({ label: `Stripe key (${f.keyMode} mode)`, status: 'ok', detail: f.accountId })

  if (!f.configFound) {
    items.push({
      label: 'stripe.config.ts',
      status: 'fail',
      detail: 'not found — run `stripekit init`',
    })
    return items
  }
  if (f.configError) {
    items.push({ label: 'stripe.config.ts', status: 'fail', detail: f.configError })
    return items
  }
  items.push({ label: 'stripe.config.ts', status: 'ok', detail: `${f.productCount} product(s)` })

  if (f.pendingChanges === 0) {
    items.push({ label: 'Config vs. account', status: 'ok', detail: 'in sync' })
  } else if (f.pendingChanges !== null) {
    items.push({
      label: 'Config vs. account',
      status: 'warn',
      detail: `${f.pendingChanges} pending change(s) — run \`stripekit push\``,
    })
  }

  if (f.webhookRegistered) {
    items.push({
      label: 'Webhook endpoint',
      status: f.webhookSecretPresent ? 'ok' : 'warn',
      detail: f.webhookSecretPresent
        ? f.webhookUrl
        : `registered, but STRIPE_WEBHOOK_SECRET is not in your env`,
    })
  } else if (f.webhookConfigured) {
    items.push({
      label: 'Webhook endpoint',
      status: 'warn',
      detail: f.baseUrlResolved
        ? 'configured but not registered — run `stripekit push`'
        : 'not registered yet — no deployment URL (use `stripekit dev` locally)',
    })
  }

  if (f.portalRegistered) {
    items.push({
      label: 'Customer portal',
      status: f.portalIdPresent ? 'ok' : 'warn',
      detail: f.portalIdPresent
        ? undefined
        : 'configured, but STRIPE_PORTAL_CONFIGURATION_ID is not in your env',
    })
  } else if (f.portalConfigured) {
    items.push({
      label: 'Customer portal',
      status: 'warn',
      detail: 'configured but not created — run `stripekit push`',
    })
  }

  return items
}

export async function runCheck(opts: CheckOptions): Promise<void> {
  const facts = await gatherFacts(opts)
  const items = evaluateChecks(facts)
  const hasFail = items.some((i) => i.status === 'fail')

  if (opts.json) {
    process.stdout.write(`${JSON.stringify({ ok: !hasFail, items }, null, 2)}\n`)
  } else {
    console.log(`${pc.bold('stripekit check')}\n`)
    for (const item of items) console.log(renderItem(item))
    console.log(`\n${hasFail ? pc.red('✗ Problems found.') : pc.green('✓ Looks good.')}`)
  }
  if (hasFail) process.exitCode = 1
}

export async function gatherFacts(opts: CheckOptions): Promise<CheckFacts> {
  const secretKey = resolveEnvVar(opts.cwd, ENV.secretKey)
  const facts: CheckFacts = {
    hasKey: !!secretKey,
    keyMode: null,
    keyValid: null,
    configFound: findConfigPath(opts.cwd) !== null,
    configError: null,
    productCount: null,
    pendingChanges: null,
    webhookConfigured: false,
    webhookRegistered: false,
    webhookSecretPresent: !!resolveEnvVar(opts.cwd, ENV.webhookSecret),
    baseUrlResolved: false,
    portalConfigured: false,
    portalRegistered: false,
    portalIdPresent: !!resolveEnvVar(opts.cwd, ENV.portalConfigId),
  }
  if (!secretKey) return facts

  try {
    facts.keyMode = detectMode(secretKey)
  } catch {
    return facts // malformed key
  }

  const stripe = createStripeClient(secretKey)
  try {
    // A cheap authenticated call that validates the key for the current account.
    await stripe.balance.retrieve()
    facts.keyValid = true
  } catch {
    facts.keyValid = false
    return facts
  }

  if (!facts.configFound) return facts

  let config
  try {
    ;({ config } = await loadConfig(opts.cwd))
  } catch (err) {
    facts.configError =
      (err instanceof Error ? err.message.split('\n')[0] : null) ?? 'failed to load config'
    return facts
  }
  facts.productCount = Object.keys(config.products).length
  facts.webhookConfigured = !!config.webhooks
  facts.portalConfigured = config.portal !== false && config.portal != null

  const baseUrl = opts.url ?? resolveEnvVar(opts.cwd, ENV.appUrl) ?? null
  facts.baseUrlResolved = !!baseUrl

  const desired = buildDesiredState(config, { baseUrl })
  const current = await readCurrentState(stripe)
  facts.pendingChanges = diff(desired, current).actions.length
  facts.webhookRegistered = current.webhook !== null
  facts.webhookUrl = current.webhook?.url
  facts.portalRegistered = current.portal !== null

  return facts
}

function renderItem(item: CheckItem): string {
  const mark =
    item.status === 'ok' ? pc.green('✓') : item.status === 'warn' ? pc.yellow('!') : pc.red('✗')
  const detail = item.detail ? pc.dim(` — ${item.detail}`) : ''
  return `  ${mark} ${item.label}${detail}`
}
