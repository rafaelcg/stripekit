---
description: Manage Stripe billing with stripekit — reconcile a declarative catalog (products, prices, webhook endpoint, customer portal) and inspect a Stripe account. Use when adding or changing Stripe subscriptions, plans, pricing, checkout, or the billing portal, or when verifying a project's Stripe setup.
---

# stripekit

This plugin connects the **stripekit MCP server**. Use its tools against a project that has a `stripe.config.ts` and a `STRIPE_SECRET_KEY` (in the environment or `.env.local`).

## Tools

- **`stripekit_plan`** — preview the changes reconciliation would make. Read-only.
- **`stripekit_check`** — verify the key, config, config-vs-account drift, and webhook/portal wiring. Read-only.
- **`stripekit_pull`** — generate `stripe.config.ts` from an existing account. Read-only.
- **`stripekit_push`** — reconcile the account to `stripe.config.ts`. **Dry-run by default**; pass `apply: true` to actually apply, and `live: true` (in addition) to modify a live-mode account.

Each tool takes an optional `cwd` — the project directory containing `stripe.config.ts`.

## What to know

- Prices are referenced by stable **lookup keys** (`product_price`), so amounts can change without touching app code.
- `push` is safe: it only touches objects stripekit created, replaces prices instead of mutating them, and archives removals instead of deleting — existing subscriptions are never disrupted.
- Confirm with the user before calling `stripekit_push` with `apply: true`, and never pass `live: true` without explicit user consent.

Full guide: <https://stripe.rafael.ltd/SKILL.md> · Docs: <https://stripe.rafael.ltd/>
