---
name: stripekit
description: Add Stripe billing — subscriptions, checkout, and the customer portal — to an app by declaring a catalog in code and running the stripekit CLI. Use when a user wants to add payments, subscriptions, plans, pricing, checkout, or a billing portal with Stripe (especially in a Next.js app), or to manage Stripe products/prices declaratively from a config file.
---

# Using stripekit

`stripekit` is a CLI that (1) reconciles a declarative `stripe.config.ts` into the user's **own** Stripe account and (2) scaffolds correct billing code into a Next.js App Router app. It's plain Stripe underneath — no hosted service, no runtime dependency.

Install-free: every command runs via `npx stripekit@latest <command>`. Always check npm for the latest version.

## Prerequisites

- Node.js 20+.
- A Stripe **test** secret key (`sk_test_…`) available as `STRIPE_SECRET_KEY` in the environment or `.env.local`. Never enter real keys on the user's behalf — ask them to add it.

## Full setup in a Next.js app

1. `npx stripekit@latest init` — detects the framework + auth library, writes `stripe.config.ts`, and scaffolds `lib/stripe/*` (client, sync, customer helpers, storage adapter) and `app/api/stripe/*` (webhook, checkout, portal). Flags: `--adapter kv|drizzle`, `--auth clerk|authjs|better-auth|none`, `--yes`.
2. Edit `stripe.config.ts` to define products, prices, and features.
3. `npx stripekit plan` — preview what will change on the Stripe account (read-only).
4. `npx stripekit push` — create/update products, prices, webhook endpoint, and portal; writes `STRIPE_WEBHOOK_SECRET` and `STRIPE_PORTAL_CONFIGURATION_ID` back to `.env.local`.
5. `npx stripekit dev` — forward Stripe webhooks to localhost during development (wraps `stripe listen`).
6. `npx stripekit check` — verify keys, config, drift, and webhook/portal wiring.

## Any stack (catalog only)

Running `init` in a non-Next.js project sets up only `stripe.config.ts`. Use `plan` / `push` / `pull` to manage the catalog from any stack.

## Config shape

```ts
import { defineConfig } from 'stripekit'

export default defineConfig({
  products: {
    pro: {
      name: 'Pro',
      prices: {
        monthly: { amount: 2000, currency: 'usd', interval: 'month' }, // amount in cents
        yearly: { amount: 19200, currency: 'usd', interval: 'year' },
      },
      features: { seats: 5, projects: 'unlimited' },
    },
  },
  portal: { cancellations: true, planSwitching: true },
  webhooks: { path: '/api/stripe/webhook' },
})
```

Reference prices in app code by their stable **lookup key** — `product_price`, e.g. `pro_monthly` — never a Stripe price ID. Amounts can change without touching app code.

## Machine-readable output (for agents/CI)

Every command accepts `--json`.

- `plan --json` / `push --json` → `{ mode, summary: { create, update, replace, destroy, total }, actions: [{ kind, effect, description }], applied, appliedCount?, envUpdated? }`.
- `check --json` → `{ ok, items: [{ label, status, detail }] }`.
- `pull --json` → `{ productCount, priceCount, warnings, source }`.

Use `--yes` to skip prompts. To apply to a **live** account you must pass both `--live` and `--yes`; do this only with explicit user confirmation.

## Safety invariants

- `push` only reads/mutates objects stripekit created (tagged via metadata). Anything the user made by hand in the Stripe dashboard is never touched.
- Prices are immutable in Stripe: an amount/interval change creates a new price, moves the lookup key onto it, and archives the old one. Existing subscriptions are never disrupted.
- Removed items are archived, never deleted. Reconciliation is idempotent (apply then re-plan → zero changes).

## More

Docs: https://rafaelcg.github.io/stripekit/ · Machine index: https://rafaelcg.github.io/stripekit/llms.txt · Source: https://github.com/rafaelcg/stripekit
