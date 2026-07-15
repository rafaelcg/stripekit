# stripekit

[![npm](https://img.shields.io/npm/v/stripekit.svg)](https://www.npmjs.com/package/stripekit)
[![CI](https://github.com/rafaelcg/stripekit/actions/workflows/ci.yml/badge.svg)](https://github.com/rafaelcg/stripekit/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/stripekit.svg)](https://github.com/rafaelcg/stripekit/blob/main/LICENSE)
[![docs](https://img.shields.io/badge/docs-rafaelcg.github.io%2Fstripekit-635bff)](https://rafaelcg.github.io/stripekit/)

**The create-next-app of Stripe.** Declare your product catalog in a config file, and `stripekit` reconciles your _own_ Stripe account to match it — creating and updating products, prices, the webhook endpoint, and the customer portal. No hosted service, no revenue share, no runtime dependency. Plain Stripe underneath, code you own on top.

> Status: early. Ships `init`, `plan`, `push`, `pull`, `dev` (local webhook forwarding), and `check` (a config/account doctor).

## Why

The painful parts of Stripe aren't the API calls — they're the dashboard ceremony, the test/live drift, and getting webhooks + state sync correct. Existing tools either replace your Stripe account (merchants of record) or put your billing state on their servers (hosted control planes). stripekit does neither: it's a dev tool that leaves you with a declarative catalog and correct-by-construction code in your repo.

## Install

```bash
npm install -D stripekit    # or pnpm add -D / yarn add -D
```

## Configure

Create `stripe.config.ts` in your project root (or run `stripekit pull` to generate one from an existing account):

```ts
import { defineConfig } from 'stripekit'

export default defineConfig({
  products: {
    pro: {
      name: 'Pro',
      prices: {
        monthly: { amount: 2000, currency: 'usd', interval: 'month' },
        yearly: { amount: 19200, currency: 'usd', interval: 'year' },
      },
      features: { seats: 5, projects: 'unlimited' },
    },
  },
  portal: { cancellations: true, planSwitching: true },
  webhooks: { path: '/api/stripe/webhook' },
})
```

Point stripekit at your account by setting `STRIPE_SECRET_KEY` (test key while developing) in your environment or `.env.local`.

## Commands

| Command           | What it does                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------- |
| `stripekit init`  | Scaffold `stripe.config.ts` and correct-by-construction billing code into a Next.js (App Router) app.         |
| `stripekit plan`  | Preview the changes `push` would make. Never mutates anything.                                                |
| `stripekit push`  | Reconcile your Stripe account to match `stripe.config.ts`. Test mode by default; live mode requires `--live`. |
| `stripekit pull`  | Generate `stripe.config.ts` from your existing catalog (read-only).                                           |
| `stripekit dev`   | Forward Stripe webhooks to your local app and capture the signing secret (wraps `stripe listen`).             |
| `stripekit check` | Doctor: verify keys, config, config-vs-account drift, and webhook/portal wiring.                              |

Common flags: `--json` (machine-readable output for agents/CI), `--yes` (skip confirmation — required to apply to live mode non-interactively), `--url <url>` (base URL for webhook registration).

```bash
stripekit plan                 # dry run against test mode
stripekit push                 # apply to test mode
stripekit push --live --yes    # promote the same catalog to live mode
```

## How reconciliation works

- **Stable identity.** Every managed object is tagged (`lookup_key` + `stripekit_key` metadata). stripekit only ever reads and mutates objects it created — anything you made by hand in the dashboard is invisible to it and never touched.
- **Prices are immutable.** Changing an amount, currency, or interval creates a new price, moves the lookup key onto it, and archives the old one — so your checkout code (which references the lookup key) keeps working.
- **Archive, never delete.** Removing a product or price from config archives it (`active: false`); existing subscriptions are never disrupted.
- **Idempotent & crash-safe.** Applying a plan then re-planning yields zero changes. Every create carries a stable idempotency key, so a re-run after a crash won't double-create.
- **One config, two modes.** The same file targets test and live. `push --live` is how catalog changes are promoted, which kills test/live drift.

## The webhook signing secret

When stripekit creates the webhook endpoint, Stripe returns the signing secret exactly once. stripekit captures it and writes `STRIPE_WEBHOOK_SECRET` to your env file immediately — it is not retrievable via the API afterward.

## For AI agents

Point your coding agent at **[SKILL.md](https://rafaelcg.github.io/stripekit/SKILL.md)** and it can set stripekit up for you. The docs are also available as **[llms.txt](https://rafaelcg.github.io/stripekit/llms.txt)** / **[llms-full.txt](https://rafaelcg.github.io/stripekit/llms-full.txt)**, and every command accepts `--json` and `--yes`.

## License

MIT
