import pc from 'picocolors'
import type { Interval } from '../config/types'
import { actionEffect, type Action, type Plan } from './types'

type Effect = 'create' | 'update' | 'destroy' | 'replace'

const SYMBOL: Record<Effect, string> = { create: '+', update: '~', destroy: '-', replace: '±' }
const PAINT: Record<Effect, (s: string) => string> = {
  create: pc.green,
  update: pc.yellow,
  destroy: pc.red,
  replace: pc.magenta,
}

export interface PlanSummary {
  create: number
  update: number
  replace: number
  destroy: number
  total: number
}

export function isEmptyPlan(plan: Plan): boolean {
  return plan.actions.length === 0
}

export function summarizePlan(plan: Plan): PlanSummary {
  const summary: PlanSummary = {
    create: 0,
    update: 0,
    replace: 0,
    destroy: 0,
    total: plan.actions.length,
  }
  for (const action of plan.actions) summary[actionEffect(action.kind)]++
  return summary
}

/** A single, uncolored, human-readable line describing one action. */
export function describeAction(action: Action): string {
  switch (action.kind) {
    case 'create_product':
      return `product "${action.productKey}" — ${action.desired.name}`
    case 'update_product':
      return `product "${action.productKey}" — ${fieldList(action.changes.map((c) => c.field))}`
    case 'archive_product':
      return `product "${action.productKey}" (${action.name}) — archive`
    case 'create_price':
      return `price "${action.priceKey}" — ${formatMoney(action.desired)}`
    case 'update_price':
      return `price "${action.priceKey}" — ${fieldList(action.changes.map((c) => c.field))}`
    case 'replace_price':
      return `price "${action.priceKey}" — ${fieldList(
        action.changes.map((c) => c.field),
      )} changed; recreate + move lookup key + archive old`
    case 'archive_price':
      return `price "${action.priceKey}" — archive`
    case 'create_webhook':
      return `webhook ${action.url} — ${action.events.length} events`
    case 'update_webhook':
      return `webhook — ${fieldList(action.changes.map((c) => c.field))}`
    case 'create_portal':
      return `customer portal configuration`
    case 'update_portal':
      return `customer portal — ${
        action.changes.length
          ? fieldList(action.changes.map((c) => c.field))
          : 'refresh switchable plans'
      }`
  }
}

/** Render the full plan, terraform-style, with a leading symbol per line. */
export function renderPlan(plan: Plan, opts: { color?: boolean } = {}): string {
  if (isEmptyPlan(plan)) return pc.dim('No changes. Your Stripe account matches stripe.config.ts.')

  const color = opts.color ?? true
  const lines = plan.actions.map((action) => {
    const effect = actionEffect(action.kind)
    const symbol = SYMBOL[effect]
    const text = `${symbol} ${describeAction(action)}`
    return `  ${color ? PAINT[effect](text) : text}`
  })

  const s = summarizePlan(plan)
  const counts = [
    s.create ? `${s.create} to create` : null,
    s.update ? `${s.update} to update` : null,
    s.replace ? `${s.replace} to replace` : null,
    s.destroy ? `${s.destroy} to archive` : null,
  ]
    .filter(Boolean)
    .join(', ')

  return `${lines.join('\n')}\n\n${pc.bold('Plan:')} ${counts}.`
}

function fieldList(fields: string[]): string {
  return fields.join(', ')
}

export function formatMoney(price: {
  unitAmount: number
  currency: string
  interval: Interval | null
  intervalCount: number
}): string {
  const major = (price.unitAmount / 100).toFixed(2)
  const amount = `${major} ${price.currency.toUpperCase()}`
  if (!price.interval) return `${amount} one-time`
  const every =
    price.intervalCount > 1 ? `${price.intervalCount} ${price.interval}s` : price.interval
  return `${amount} / ${every}`
}
