# stripekit dev

Forward Stripe webhooks to your local app during development, and capture the signing secret automatically. Wraps the Stripe CLI's `stripe listen`.

```bash
npx stripekit dev
```

## What it does

1. Reads your `STRIPE_SECRET_KEY` and the webhook path from `stripe.config.ts`.
2. Runs `stripe listen`, forwarding events to `localhost:3000` + your webhook path.
3. Captures the local signing secret from the output and writes `STRIPE_WEBHOOK_SECRET` to `.env.local` — so the generated handler verifies signatures with no copy-paste.
4. Streams forwarded events to your terminal. `Ctrl-C` stops it.

```
stripekit dev — forwarding test webhooks → localhost:3000/api/stripe/webhook
Press Ctrl-C to stop.

✓ Wrote STRIPE_WEBHOOK_SECRET (local) to .env.local — restart your dev server if it's already running.

2026-07-15  --> customer.subscription.created [evt_1Nz...]
2026-07-15  <--  [200] POST http://localhost:3000/api/stripe/webhook
```

## Prerequisites

The [Stripe CLI](https://docs.stripe.com/stripe-cli) must be installed (macOS: `brew install stripe/stripe-cli/stripe`). stripekit passes your key to it via the `STRIPE_API_KEY` environment variable, so you don't need to run `stripe login` separately, and the key never appears in your process list.

## Options

| Flag                 | Description                                                            |
| -------------------- | ---------------------------------------------------------------------- |
| `--port <port>`      | Local port your app runs on. Defaults to `3000`.                       |
| `--path <path>`      | Webhook route path. Defaults to `webhooks.path` in your config.        |
| `--forward-to <url>` | Full forward target, overriding `--port`/`--path` (e.g. a tunnel URL). |
| `--events <list>`    | Comma-separated event types to forward. Defaults to the handler's set. |
| `--all-events`       | Forward every event type.                                              |

## Typical workflow

Run `dev` in one terminal and your app in another:

```bash
# terminal 1
npx stripekit dev

# terminal 2
npm run dev
```

The `stripe listen` signing secret is stable for your account/device, so it's written once. If your dev server was already running when the secret was first written, restart it so Next.js picks up the new `.env.local` value.
