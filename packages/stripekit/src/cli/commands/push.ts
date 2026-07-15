import { confirm, isCancel } from '@clack/prompts'
import { relative } from 'node:path'
import pc from 'picocolors'
import { ENV } from '../../constants'
import { loadConfig } from '../../config/load'
import { applyPlan } from '../../reconciler/apply'
import { buildDesiredState } from '../../reconciler/desired'
import { diff } from '../../reconciler/diff'
import { describeAction, isEmptyPlan, renderPlan, summarizePlan } from '../../reconciler/plan'
import { readCurrentState } from '../../reconciler/read-state'
import { actionEffect } from '../../reconciler/types'
import { StripekitError } from '../../util/errors'
import { chooseEnvFile, resolveEnvVar, upsertEnv } from '../../util/env'
import { createContext } from '../context'

export interface PushOptions {
  cwd: string
  dryRun?: boolean
  /** Explicit acknowledgment required to apply changes when the key is a live-mode key. */
  live?: boolean
  yes?: boolean
  json?: boolean
  url?: string
}

export async function runPush(opts: PushOptions): Promise<void> {
  const ctx = createContext(opts.cwd)
  const { config } = await loadConfig(opts.cwd)
  const baseUrl = opts.url ?? resolveEnvVar(opts.cwd, ENV.appUrl) ?? null

  const desired = buildDesiredState(config, { baseUrl })
  const current = await readCurrentState(ctx.stripe)
  const plan = diff(desired, current)

  if (opts.json) {
    await runJson(ctx, plan, current, desired, opts)
    return
  }

  console.log(`${pc.bold('stripekit')} — reconciling ${modeLabel(ctx.mode)}\n`)
  if (config.webhooks && !baseUrl) {
    console.log(
      pc.dim(
        'note: skipping webhook endpoint — no deployment URL. Pass --url or set NEXT_PUBLIC_APP_URL, and use `stripekit dev` for local forwarding.\n',
      ),
    )
  }
  console.log(renderPlan(plan))

  if (isEmptyPlan(plan) || opts.dryRun) return

  if (ctx.mode === 'live') {
    requireLiveFlag(opts.live)
    if (!(await confirmLive(opts.yes))) {
      console.log(pc.yellow('\nAborted. No changes made.'))
      return
    }
  }

  console.log('')
  const outcome = await applyPlan(ctx.stripe, plan, current, desired, {
    logger: (line) => console.log(`${pc.green('✓')} ${line}`),
  })

  const envKeys = Object.keys(outcome.envUpdates)
  if (envKeys.length) {
    const envPath = chooseEnvFile(opts.cwd)
    upsertEnv(envPath, outcome.envUpdates)
    console.log(
      pc.dim(`\nWrote ${envKeys.join(', ')} to ${relative(opts.cwd, envPath) || envPath}`),
    )
  }
  console.log(
    pc.bold(`\nApplied ${outcome.appliedCount} change${outcome.appliedCount === 1 ? '' : 's'}.`),
  )
}

export async function runPlan(opts: Omit<PushOptions, 'dryRun'>): Promise<void> {
  await runPush({ ...opts, dryRun: true })
}

function requireLiveFlag(live?: boolean): void {
  if (!live) {
    throw new StripekitError(
      'Live-mode key detected — refusing to modify your live Stripe account.',
      {
        hint: 'Re-run with --live to confirm you intend to apply changes to live mode.',
      },
    )
  }
}

async function confirmLive(yes?: boolean): Promise<boolean> {
  if (yes) return true
  // Gate on the stream the prompt actually reads (stdin). Checking stdout would
  // let `echo | stripekit push` skip the guard and auto-confirm to LIVE.
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new StripekitError('Refusing to modify a LIVE Stripe account without confirmation.', {
      hint: 'Re-run with --yes to apply in live mode non-interactively.',
    })
  }
  const answer = await confirm({ message: 'Apply these changes to your LIVE Stripe account?' })
  return !isCancel(answer) && answer === true
}

async function runJson(
  ctx: ReturnType<typeof createContext>,
  plan: ReturnType<typeof diff>,
  current: Awaited<ReturnType<typeof readCurrentState>>,
  desired: ReturnType<typeof buildDesiredState>,
  opts: PushOptions,
): Promise<void> {
  const actions = plan.actions.map((action) => ({
    kind: action.kind,
    effect: actionEffect(action.kind),
    description: describeAction(action),
  }))
  const base = { mode: ctx.mode, summary: summarizePlan(plan), actions }

  if (opts.dryRun || isEmptyPlan(plan)) {
    process.stdout.write(`${JSON.stringify({ ...base, applied: false }, null, 2)}\n`)
    return
  }
  if (ctx.mode === 'live' && !(opts.live && opts.yes)) {
    throw new StripekitError(
      'Refusing to modify a LIVE Stripe account without --live and --yes in JSON mode.',
    )
  }

  const outcome = await applyPlan(ctx.stripe, plan, current, desired)
  const envKeys = Object.keys(outcome.envUpdates)
  if (envKeys.length) upsertEnv(chooseEnvFile(opts.cwd), outcome.envUpdates)
  process.stdout.write(
    `${JSON.stringify({ ...base, applied: true, appliedCount: outcome.appliedCount, envUpdated: envKeys }, null, 2)}\n`,
  )
}

function modeLabel(mode: 'test' | 'live'): string {
  return mode === 'live' ? pc.red(pc.bold('LIVE mode')) : pc.cyan('test mode')
}
