# AGENTS.md

Guidance for AI agents working **on** the stripekit codebase. (To learn how to **use** stripekit in a project, read [`SKILL.md`](./SKILL.md) or [llms.txt](https://stripe.rafael.ltd/llms.txt) instead.)

## What this is

stripekit is the "create-next-app of Stripe": a CLI that reconciles a declarative `stripe.config.ts` into the user's own Stripe account and scaffolds correct billing code. It is a **tool, not a platform** — no hosted service, no runtime dependency in generated code. See [`README.md`](./README.md) and [`DESIGN.md`](./DESIGN.md) for the full picture.

## Layout

- `packages/stripekit/src/` — the CLI + library.
  - `config/` — `defineConfig`, zod schema, TS config loader.
  - `reconciler/` — the core: `desired.ts` (config → desired state), `diff.ts` (pure diff → plan), `apply.ts`, `read-state.ts`, `pull.ts`, `plan.ts`.
  - `cli/commands/` — `init`, `plan`, `push`, `pull`, `dev`, `check`.
  - `init/` — framework/auth detection + scaffolding.
- `packages/stripekit/templates/init/` — the billing code emitted by `init` (real TS files, not compiled by the tool).
- `packages/stripekit/test/` — vitest; `fake-stripe.ts` is an in-memory Stripe used to test the whole reconcile loop offline.
- `docs/` — VitePress site. `examples/playground/` — a scratch project.

## Setup & commands

Node 20+ and pnpm. From the repo root:

```bash
pnpm install
pnpm -C packages/stripekit build       # bundle CLI + types (tsup)
pnpm -C packages/stripekit test        # vitest
pnpm -C packages/stripekit typecheck   # tsc --noEmit
pnpm format                            # prettier
pnpm docs:build                        # build the docs site
```

Always run `test`, `typecheck`, and `format` before committing.

## Releasing

`stripekit` is published to npm. Keep one version number across `packages/stripekit/package.json`, `src/constants.ts` (`VERSION`), `docs/public/.well-known/mcp/server-card.json`, `server.json`, `.claude-plugin/plugin.json`, and `.claude-plugin/marketplace.json`.

```bash
pnpm -C packages/stripekit build
cd packages/stripekit && npm publish   # publishConfig makes it public
```

The MCP registry (`registry.modelcontextprotocol.io`, still preview) lists the server so agents can discover it. It verifies ownership by reading `mcpName` from the **published** npm package, so publish to npm first, then:

```bash
# one-time: brew install mcp-publisher (or download from the registry releases)
mcp-publisher login github           # GitHub device flow; locks the io.github.rafaelcg/* namespace
mcp-publisher publish                 # reads ./server.json
```

`server.json`'s `packages[].version` must equal an npm version whose published `package.json` already contains `mcpName` (`io.github.rafaelcg/stripekit`). The Claude Code plugin and Cursor deeplink both run `npx -y stripekit@latest mcp`, so they need no per-release change — only a published npm version.

## Safety invariants (do not break these)

The reconciler mutates real Stripe accounts and generates people's billing code. Preserve:

1. **Tag-only mutation** — `push` reads/writes only objects carrying stripekit metadata (`stripekit_key` / `stripekit_managed`). Never touch untagged objects.
2. **Prices are immutable** — amount/currency/interval changes become _replace_ (create new + `transfer_lookup_key` + archive old), never an update.
3. **Archive, never delete.**
4. **Idempotent** — apply a plan, re-diff → zero actions. There's a golden convergence test; keep it passing.
5. **Live gate** — `push` requires `--live` (and `--yes` for non-interactive) to modify a live-mode key.
6. **Generated code correctness** — the templates encode hard-won Stripe details (item-level `current_period_end`, single-writer sync, raw-body webhook verification). Verify template changes against real Stripe types.

## Conventions

- TypeScript, ESM, strict. Keep the diff engine **pure** and unit-tested.
- The `templates/init/` files are real TS — type-check template changes against a real Next.js project (stripe v22, drizzle-orm, @upstash/redis).
- Match existing style; run `pnpm format`.
