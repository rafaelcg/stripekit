import { evaluateChecks, gatherFacts } from '../cli/commands/check'
import { createContext } from '../cli/context'
import { loadConfig } from '../config/load'
import { ENV } from '../constants'
import { applyPlan } from '../reconciler/apply'
import { buildDesiredState } from '../reconciler/desired'
import { diff } from '../reconciler/diff'
import { describeAction, summarizePlan } from '../reconciler/plan'
import { pullConfig } from '../reconciler/pull'
import { readCurrentState } from '../reconciler/read-state'
import { actionEffect, type Plan } from '../reconciler/types'
import { StripekitError } from '../util/errors'
import { chooseEnvFile, resolveEnvVar, upsertEnv } from '../util/env'

/**
 * Programmatic handlers behind the MCP tools. Each returns a plain, structured
 * object (never writes to stdout — that's the MCP transport). They reuse the
 * exact reconciler the CLI uses.
 */

function serializeActions(plan: Plan) {
  return plan.actions.map((action) => ({
    kind: action.kind,
    effect: actionEffect(action.kind),
    description: describeAction(action),
  }))
}

export async function mcpPlan(cwd: string, url?: string) {
  const ctx = createContext(cwd)
  const { config } = await loadConfig(cwd)
  const baseUrl = url ?? resolveEnvVar(cwd, ENV.appUrl) ?? null
  const desired = buildDesiredState(config, { baseUrl })
  const current = await readCurrentState(ctx.stripe)
  const plan = diff(desired, current)
  return { mode: ctx.mode, summary: summarizePlan(plan), actions: serializeActions(plan) }
}

export interface McpPushOptions {
  url?: string
  apply?: boolean
  live?: boolean
}

export async function mcpPush(cwd: string, opts: McpPushOptions = {}) {
  const ctx = createContext(cwd)
  const { config } = await loadConfig(cwd)
  const baseUrl = opts.url ?? resolveEnvVar(cwd, ENV.appUrl) ?? null
  const desired = buildDesiredState(config, { baseUrl })
  const current = await readCurrentState(ctx.stripe)
  const plan = diff(desired, current)
  const base = { mode: ctx.mode, summary: summarizePlan(plan), actions: serializeActions(plan) }

  if (!opts.apply || plan.actions.length === 0) {
    return { ...base, applied: false }
  }
  if (ctx.mode === 'live' && !opts.live) {
    throw new StripekitError(
      'This is a live-mode key. Pass live:true (with apply:true) to modify your live Stripe account.',
    )
  }

  const outcome = await applyPlan(ctx.stripe, plan, current, desired)
  const envUpdated = Object.keys(outcome.envUpdates)
  if (envUpdated.length) upsertEnv(chooseEnvFile(cwd), outcome.envUpdates)
  return { ...base, applied: true, appliedCount: outcome.appliedCount, envUpdated }
}

export async function mcpPull(cwd: string) {
  const ctx = createContext(cwd)
  const result = await pullConfig(ctx.stripe)
  return {
    productCount: result.productCount,
    priceCount: result.priceCount,
    warnings: result.warnings,
    source: result.source,
  }
}

export async function mcpCheck(cwd: string, url?: string) {
  const facts = await gatherFacts({ cwd, url })
  const items = evaluateChecks(facts)
  return { ok: !items.some((i) => i.status === 'fail'), items }
}
