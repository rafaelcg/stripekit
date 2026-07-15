# stripekit

**The create-next-app of Stripe.** One command takes an app from zero to working payments on _your_ Stripe account: it provisions your catalog from a config file in your repo, and (soon) drops in correct-by-construction billing code you own. No hosted service. No revenue share. Nothing to depend on at runtime. Works identically whether a human or an agent runs it.

## Repository layout

| Path                                               | What it is                                                                        |
| -------------------------------------------------- | --------------------------------------------------------------------------------- |
| [`packages/stripekit`](./packages/stripekit)       | The `stripekit` npm package — CLI + config API.                                   |
| [`DESIGN.md`](./DESIGN.md)                         | The MVP design: CLI surface, config schema, generated code, build order.          |
| [`research/landscape.md`](./research/landscape.md) | Competitive landscape and where the "create-next-app of Stripe" position is open. |

## Status

Built and tested: `stripekit init | plan | push | pull | dev`.

- **Reconciler** (`plan` / `push` / `pull`) — reconciles your Stripe account to a declarative `stripe.config.ts` (products, prices, webhook endpoint, customer portal), treating prices as immutable, archiving instead of deleting, and converging idempotently.
- **`init`** — scaffolds `stripe.config.ts` plus correct-by-construction billing code (webhook handler, state sync, checkout/portal routes) into a Next.js App Router app.
- **`dev`** — wraps `stripe listen` to forward webhooks locally and capture the signing secret.

There's also a [VitePress docs site](./docs) with a landing page — run `pnpm docs:dev`. Next on the roadmap (see `DESIGN.md`): `check` (drift/health doctor) and `init` support beyond Next.js.

See the [package README](./packages/stripekit#readme) for usage.

## Develop

```bash
pnpm install
pnpm -C packages/stripekit build      # bundle CLI + types
pnpm -C packages/stripekit test       # unit + integration tests
pnpm -C packages/stripekit typecheck
```

## License

MIT
