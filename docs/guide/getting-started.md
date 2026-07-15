# Getting started

stripekit turns your Stripe catalog into a file in your repo and reconciles your **own** Stripe account to match it — then (with `init`) drops correct billing code into your app. No hosted service, no merchant of record, no revenue share.

## Requirements

- Node.js 20+
- A Stripe account (or none — `init` can bootstrap a sandbox)

## Install

```bash
npm install -D stripekit
# or: pnpm add -D stripekit / yarn add -D stripekit
```

## 1. Create a config

Create `stripe.config.ts` in your project root:

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

Already have products in Stripe? Generate the config from your account instead:

```bash
npx stripekit pull
```

## 2. Point stripekit at your account

Set your Stripe **test** secret key in the environment or `.env.local`:

```bash
# .env.local
STRIPE_SECRET_KEY=sk_test_...
```

stripekit reads `STRIPE_SECRET_KEY` from your environment, then `.env.local`, then `.env`. The `sk_test_`/`sk_live_` prefix decides which mode it targets.

## 3. Preview and apply

```bash
npx stripekit plan   # terraform-style diff — nothing is changed
npx stripekit push   # create/update products, prices, webhook, portal
```

`plan` prints exactly what `push` will do:

```
stripekit — reconciling test mode

  + product "pro" — Pro
  + price "pro_monthly" — 20.00 USD / month
  + price "pro_yearly" — 192.00 USD / year
  + customer portal configuration

Plan: 4 to create.
```

Run `push` again and you'll get **No changes.** — the reconciler is idempotent.

## 4. Promote to live

The same config targets both modes. When you're ready, swap in your live key and promote:

```bash
STRIPE_SECRET_KEY=sk_live_... npx stripekit push --live
```

Live mode asks for confirmation before touching anything (use `--yes` in CI).

## Next steps

- [How it works](/guide/how-it-works) — immutability, tagging, and convergence
- [`stripekit init`](/cli/init) — scaffold the webhook handler and billing code
- [Config reference](/config) — every field in `stripe.config.ts`
