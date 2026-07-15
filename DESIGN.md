# Design: the create-next-app of Stripe

Working name: **stripekit** (placeholder — check npm availability; alternatives: `stripescaffold`, `paykit`, `stripe-init`).

## Thesis

Stripe setup pain isn't the API — it's the ceremony (dashboard clicking, env vars, webhook registration, test/live drift) and the correctness traps (webhook ordering, dedup, state sync). We solve both with a CLI that is **deterministic, idempotent, and leaves behind only code you own**. No hosted service, no runtime dependency, plain Stripe as the source of truth.

See `research/landscape.md` for why this position is open.

## The demo that sells it

```
npx stripekit init
```

From an empty Next.js app to a working paid subscription — checkout, webhook-synced customer state, customer portal — **in under 2 minutes, without visiting the Stripe dashboard, and without even having a Stripe account** (bootstraps via `stripe sandbox create`). Same flow works when Claude/Cursor runs it.

## CLI surface (v1)

| Command | What it does                                                                                                                                                                                                                         |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `init`  | Detect framework → get keys (existing env, `stripe login`, or `stripe sandbox create --non-interactive` for zero-account start) → write `stripe.config.ts` from a template picker → scaffold code → wire env → run first `push`      |
| `push`  | Diff `stripe.config.ts` against the Stripe account and reconcile (create/update products, prices, webhook endpoint, portal config). Sandbox/test by default; `--live` gated behind confirmation. Prints a terraform-style plan first |
| `pull`  | Import an existing account's catalog into `stripe.config.ts`                                                                                                                                                                         |
| `dev`   | Wraps `stripe listen --forward-to`, injects the ephemeral webhook secret into the running app's env                                                                                                                                  |
| `check` | Doctor: keys valid, webhook endpoint live + secret matches, config in sync with account, handler route reachable                                                                                                                     |

Every command supports `--yes` (non-interactive) and `--json` (machine-readable output). That plus a shipped `SKILL.md` is the entire agent story — agents don't need special endpoints, they need commands that can't lie.

### Reconciliation mechanics (the hard part of `push`)

- Every managed Stripe object is tagged: prices via `lookup_key`, products via `metadata.stripekit_key`. `push` never touches untagged objects — safe to run against an account with existing hand-made products.
- Prices are immutable in Stripe → amount changes create a new price, archive the old one, keep the lookup_key pointing at the new one. The plan output makes this explicit.
- Test and live are just two targets of the same config; `push --live` is how catalog changes are promoted. This kills test/live drift.

## `stripe.config.ts`

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
  sync: { adapter: 'drizzle' }, // where customer state lands
})
```

Features are stored in product metadata and surface in the generated `hasFeature()` helper — entitlements without a control plane.

## Generated code (Next.js App Router, v1)

Scaffolded into the user's repo, readable, theirs to edit:

- `lib/stripe/client.ts` — configured SDK client
- `lib/stripe/sync.ts` — **the t3dotgg pattern as code**: one `syncStripeCustomerState(customerId)` that fetches the canonical state from Stripe and upserts it into the adapter (Drizzle table / KV). Called from both the success redirect and the webhook handler, so ordering never matters
- `app/api/stripe/webhook/route.ts` — signature verification, event-ID dedup, the ~17 relevant event types routed into `sync.ts`, everything else 200-and-ignored
- `app/api/stripe/checkout/route.ts` — creates customer eagerly (before checkout, per the t3 pattern), starts Checkout Session by price lookup_key
- `app/api/stripe/portal/route.ts` — customer portal redirect
- `lib/stripe/customer.ts` — `getCustomerState(userId)`, `hasFeature(userId, key)` reading synced local state (never live API calls in request path)
- Auth integration point: one `getUserId(req)` function the user (or `init`, if it detects Clerk/better-auth/next-auth) fills in

Runtime dependency on `stripekit`: zero or near-zero (a tiny peer util at most). The CLI is a dev dependency.

## v1 scope cuts

- **Next.js App Router only.** Adapters for Hono/SvelteKit/Express later; the reconciler and templates are framework-agnostic internally.
- **Subscriptions + one-time payments only.** No usage-based billing in v1 (that's Autumn/Metronome territory and 10x the state complexity). Metadata-based feature flags cover most entitlement needs.
- **Two sync adapters:** Drizzle/Postgres and a plain KV interface (covers Redis/Upstash/Vercel KV). Prisma next.
- **No dashboard, no UI components** in v1 — billingsdk exists for UI; we can point at it.

## Build order

1. **Reconciler** (`push`/`pull`/plan) — the genuinely novel piece; useful standalone even before scaffolding exists
2. **Webhook + sync templates** — the correctness piece; must be airtight, this is the reputation-maker or -breaker
3. **`init` flow** — sandbox bootstrap, framework detection, env wiring
4. **`dev` + `check`** — polish that makes the demo feel magical
5. **SKILL.md + llms.txt + docs** — the distribution surface for agents

## Distribution

OSS (MIT), the 2-minute demo GIF, a launch post framed against the t3 rant ("we turned the README into a tool"), `npx skills add` support from day one. Success metric for v1: a stranger (or an agent) goes zero → test-mode subscription in under 5 minutes without reading docs.
