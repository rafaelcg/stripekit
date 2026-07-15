# stripekit

[![npm](https://img.shields.io/npm/v/stripekit.svg)](https://www.npmjs.com/package/stripekit)
[![CI](https://github.com/rafaelcg/stripekit/actions/workflows/ci.yml/badge.svg)](https://github.com/rafaelcg/stripekit/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/stripekit.svg)](./LICENSE)
[![docs](https://img.shields.io/badge/docs-stripe.rafael.ltd-635bff)](https://stripe.rafael.ltd/)

**The create-next-app of Stripe.** One command takes an app from zero to working payments on _your_ Stripe account: it provisions your catalog from a config file in your repo, and drops in correct-by-construction billing code you own. No hosted service. No revenue share. Nothing to depend on at runtime. Works identically whether a human or an agent runs it.

**[Documentation →](https://stripe.rafael.ltd/)**

## Repository layout

| Path                                           | What it is                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------ |
| [`packages/stripekit`](./packages/stripekit)   | The `stripekit` npm package — CLI + config API.                          |
| [`examples/playground`](./examples/playground) | A scratch project to try stripekit against a Stripe test account.        |
| [`docs`](./docs)                               | The VitePress documentation site.                                        |
| [`DESIGN.md`](./DESIGN.md)                     | The MVP design: CLI surface, config schema, generated code, build order. |

## Status

Built and tested: `stripekit init | plan | push | pull | dev | check | mcp`.

- **Reconciler** (`plan` / `push` / `pull`) — reconciles your Stripe account to a declarative `stripe.config.ts` (products, prices, webhook endpoint, customer portal), treating prices as immutable, archiving instead of deleting, and converging idempotently.
- **`init`** — scaffolds `stripe.config.ts` plus correct-by-construction billing code (webhook handler, state sync, checkout/portal routes) into a Next.js App Router app.
- **`dev`** — wraps `stripe listen` to forward webhooks locally and capture the signing secret.
- **`check`** — a doctor that verifies keys, config validity, config-vs-account drift, and webhook/portal wiring.

There's also a [VitePress docs site](./docs) with a landing page — run `pnpm docs:dev`. Roadmap (see `DESIGN.md`): `init` support beyond Next.js and richer catalog features.

See the [package README](./packages/stripekit#readme) for usage.

## For AI agents

stripekit is built to be driven by agents, not just humans:

- **[llms.txt](https://stripe.rafael.ltd/llms.txt)** and **[llms-full.txt](https://stripe.rafael.ltd/llms-full.txt)** — the docs as clean markdown for LLM context.
- **[SKILL.md](https://stripe.rafael.ltd/SKILL.md)** — point your coding agent at this and it can set stripekit up for you.
- **`stripekit mcp`** — an [MCP](https://modelcontextprotocol.io) server exposing `plan`/`push`/`pull`/`check` as tools an agent can call.
- Every command accepts `--json` and `--yes` for deterministic, non-interactive use.

Working _on_ stripekit? See [AGENTS.md](./AGENTS.md).

## Develop

```bash
pnpm install
pnpm -C packages/stripekit build      # bundle CLI + types
pnpm -C packages/stripekit test       # unit + integration tests
pnpm -C packages/stripekit typecheck
```

## License

MIT
