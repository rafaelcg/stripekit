# stripekit init

Scaffold `stripe.config.ts` and correct-by-construction billing code into your **Next.js App Router** app.

```bash
npx stripekit init
```

## What it does

1. **Detects** your project — Next.js, whether `app/` lives under `src/`, your `@/`-style import alias, and your auth library (Clerk, Auth.js, or better-auth).
2. **Writes `stripe.config.ts`** (a starter catalog) if you don't have one.
3. **Scaffolds billing code** you own into `lib/stripe/` and `app/api/stripe/` (see [Generated code](/guide/generated-code)).
4. **Prints the remaining manual steps** — which packages to install, which env vars to set, and any auth/middleware wiring.

Existing files are never overwritten — anything already present is reported as skipped.

## Options

| Flag                                        | Description                                                                                      |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `--adapter <kv\|drizzle>`                   | Where synced customer state is stored. Defaults to an interactive prompt (or `kv` with `--yes`). |
| `--auth <clerk\|authjs\|better-auth\|none>` | Auth library for `getUserId`. Defaults to auto-detection.                                        |
| `-y, --yes`                                 | Accept defaults without prompting (for CI / agents).                                             |

## Storage adapters

- **`kv`** — Upstash Redis (or Vercel Marketplace KV). Self-contained; just needs `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`. Great for getting started.
- **`drizzle`** — Postgres via Drizzle. Adds a `stripe_customers` table (`schema.ts`) and a pooled client (`db.ts`); needs `DATABASE_URL` and a migration.

Both implement the same `CustomerStore` interface, so `sync.ts` never imports a DB client directly — swap adapters by editing one file.

## After init

```bash
# 1. install the packages init listed
npm install stripe server-only @upstash/redis

# 2. set STRIPE_SECRET_KEY (+ adapter env) in .env.local

# 3. create the products, webhook, and portal on Stripe
npx stripekit push
```

`push` writes `STRIPE_WEBHOOK_SECRET` and `STRIPE_PORTAL_CONFIGURATION_ID` back to your env file automatically.

::: tip Local webhooks
For local development, run [`stripekit dev`](/cli/dev) — it forwards events and writes the local signing secret to `.env.local` for you.
:::

## Scope

`init` currently targets **Next.js App Router**. The reconciler (`plan` / `push` / `pull`) works with any stack today — `init` support for other frameworks is on the roadmap.
