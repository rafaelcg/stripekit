import { existsSync, writeFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { confirm, isCancel } from '@clack/prompts'
import pc from 'picocolors'
import { pullConfig } from '../../reconciler/pull'
import { StripekitError } from '../../util/errors'
import { createContext } from '../context'

export interface PullOptions {
  cwd: string
  out?: string
  json?: boolean
  yes?: boolean
  stdout?: boolean
}

export async function runPull(opts: PullOptions): Promise<void> {
  const ctx = createContext(opts.cwd)
  const result = await pullConfig(ctx.stripe)

  if (opts.stdout) {
    process.stdout.write(result.source)
    return
  }
  if (opts.json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          productCount: result.productCount,
          priceCount: result.priceCount,
          warnings: result.warnings,
          source: result.source,
        },
        null,
        2,
      )}\n`,
    )
    return
  }

  const target = resolve(opts.cwd, opts.out ?? 'stripe.config.ts')
  if (existsSync(target) && !opts.yes) {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      throw new StripekitError(`${relative(opts.cwd, target)} already exists.`, {
        hint: 'Re-run with --yes to overwrite, or --stdout to print instead.',
      })
    }
    const answer = await confirm({ message: `${relative(opts.cwd, target)} exists. Overwrite?` })
    if (isCancel(answer) || !answer) {
      console.log(pc.yellow('Aborted. Nothing written.'))
      return
    }
  }

  writeFileSync(target, result.source, 'utf8')
  console.log(
    `${pc.green('✓')} Wrote ${pc.bold(relative(opts.cwd, target) || target)} — ${result.productCount} product(s), ${result.priceCount} price(s).`,
  )
  for (const warning of result.warnings) console.log(pc.yellow(`  ! ${warning}`))
  console.log(pc.dim('Review it, then run `stripekit plan` to preview reconciliation.'))
}
