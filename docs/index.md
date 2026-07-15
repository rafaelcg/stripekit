---
layout: home

hero:
  name: stripekit
  text: The create-next-app of Stripe
  tagline: Declare your catalog. Reconcile your own Stripe account. Own the code — no hosted layer, no revenue share.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: How it works
      link: /guide/how-it-works
    - theme: alt
      text: GitHub
      link: https://github.com/rafaelcg/stripekit

features:
  - icon: 📦
    title: Catalog as code
    details: Declare products, prices, and feature entitlements in stripe.config.ts. `plan` shows a terraform-style diff; `push` reconciles your account to match.
  - icon: 🔑
    title: Your Stripe, not ours
    details: Not a merchant of record, not a hosted control plane. Plain Stripe underneath, state in your own database, nothing to depend on at runtime.
  - icon: 🪝
    title: Correct-by-construction webhooks
    details: The generated handler verifies signatures, dedupes events, and funnels everything through one sync function — so out-of-order delivery can't corrupt your state.
  - icon: ♻️
    title: Idempotent & immutable-safe
    details: Prices are replaced, never mutated; removed items are archived, never deleted. Apply a plan, re-plan, and you get zero changes.
  - icon: 🎚️
    title: One config, test and live
    details: The same file targets test and live mode. `push --live` promotes your catalog, which is what kills test/live drift for good.
  - icon: 🤖
    title: Human- and agent-ready
    details: Deterministic commands with `--json` and `--yes`. An AI agent runs the exact same three commands you do — and can't hallucinate a webhook handler.
---

## Zero to paid in three commands

```bash
# 1. Scaffold config + billing code into your Next.js app
npx stripekit init

# 2. Preview what will change on your Stripe account
npx stripekit plan

# 3. Create the products, prices, webhook, and portal
npx stripekit push
```

## Your catalog, as code

```ts
// stripe.config.ts
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

Change an amount, run `stripekit push`, and stripekit creates the new price, moves the lookup key onto it, and archives the old one — your checkout code never changes because it references the stable lookup key, not a price ID.

<div style="margin-top: 3rem; text-align: center; opacity: 0.8;">

Built on the ideas behind [“How I Stay Sane Implementing Stripe”](https://github.com/t3dotgg/stripe-recommendations) — turned into a tool.

</div>
