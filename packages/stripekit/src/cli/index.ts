#!/usr/bin/env node
import { Command } from 'commander'
import pc from 'picocolors'
import { isStripekitError } from '../util/errors'
import type { AuthLibrary, SyncAdapter } from '../init/detect'
import { runDev } from './commands/dev'
import { runInit } from './commands/init'
import { runPlan, runPush } from './commands/push'
import { runPull } from './commands/pull'

const program = new Command()

program
  .name('stripekit')
  .description(
    'The create-next-app of Stripe — declarative catalog reconciliation for your own Stripe account.',
  )
  .version('0.1.1')

program
  .command('push')
  .description('Reconcile your Stripe account to match stripe.config.ts')
  .option('--dry-run', 'Show the plan without applying it')
  .option(
    '--live',
    'Confirm applying changes to a live-mode account (required when the key is live)',
  )
  .option('-y, --yes', 'Skip the interactive confirmation prompt')
  .option('--json', 'Output machine-readable JSON (for agents / CI)')
  .option('--url <url>', 'Base URL used to register the webhook endpoint')
  .action((options) =>
    runPush({
      cwd: process.cwd(),
      dryRun: options.dryRun,
      live: options.live,
      yes: options.yes,
      json: options.json,
      url: options.url,
    }),
  )

program
  .command('plan')
  .description('Preview the changes push would make, without applying them')
  .option('--json', 'Output machine-readable JSON (for agents / CI)')
  .option('--url <url>', 'Base URL used to register the webhook endpoint')
  .action((options) => runPlan({ cwd: process.cwd(), json: options.json, url: options.url }))

program
  .command('pull')
  .description('Generate stripe.config.ts from your existing Stripe catalog (read-only)')
  .option('-o, --out <file>', 'Output path', 'stripe.config.ts')
  .option('--stdout', 'Print the config to stdout instead of writing a file')
  .option('--json', 'Output machine-readable JSON (for agents / CI)')
  .option('-y, --yes', 'Overwrite an existing config without prompting')
  .action((options) =>
    runPull({
      cwd: process.cwd(),
      out: options.out,
      stdout: options.stdout,
      json: options.json,
      yes: options.yes,
    }),
  )

program
  .command('init')
  .description(
    'Scaffold stripe.config.ts and correct-by-construction billing code into your Next.js app',
  )
  .option('--adapter <adapter>', 'State storage adapter: kv | drizzle')
  .option('--auth <auth>', 'Auth library: clerk | authjs | better-auth | none')
  .option('-y, --yes', 'Accept defaults without prompting')
  .action((options) =>
    runInit({
      cwd: process.cwd(),
      adapter: options.adapter as SyncAdapter | undefined,
      auth: options.auth as AuthLibrary | undefined,
      yes: options.yes,
    }),
  )

program
  .command('dev')
  .description(
    'Forward Stripe webhooks to your local app and capture the signing secret (wraps `stripe listen`)',
  )
  .option('--port <port>', 'Local port your app runs on (default 3000)', (v) => parseInt(v, 10))
  .option('--path <path>', 'Webhook route path (defaults to the config webhook path)')
  .option('--forward-to <url>', 'Full forward target, overriding --port/--path')
  .option('--events <list>', 'Comma-separated event types to forward')
  .option('--all-events', 'Forward every event type instead of the handler set')
  .action((options) =>
    runDev({
      cwd: process.cwd(),
      port: options.port,
      path: options.path,
      forwardTo: options.forwardTo,
      events: options.events,
      allEvents: options.allEvents,
    }),
  )

for (const [name, summary] of [
  ['check', 'Verify keys, webhook wiring, and config-vs-account drift'],
] as const) {
  program
    .command(name)
    .description(`${summary} (coming soon)`)
    .action(() => {
      console.log(
        `${pc.yellow('stripekit ' + name)} is on the roadmap but not built yet — this release ships ${pc.bold('init')}, ${pc.bold('plan')}, ${pc.bold('push')}, ${pc.bold('pull')}, and ${pc.bold('dev')}.`,
      )
    })
}

try {
  await program.parseAsync(process.argv)
} catch (err) {
  reportError(err)
  process.exit(1)
}

function reportError(err: unknown): void {
  if (isStripekitError(err)) {
    console.error(`${pc.red('error')} ${err.message}`)
    if (err.hint) console.error(pc.dim(`hint: ${err.hint}`))
    return
  }
  if (err instanceof Error && typeof (err as { type?: unknown }).type === 'string') {
    // Surface Stripe API errors compactly instead of a raw stack.
    console.error(`${pc.red('stripe error')} ${err.message}`)
    return
  }
  console.error(pc.red('unexpected error'))
  console.error(err)
}
