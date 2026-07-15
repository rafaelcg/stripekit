# Contributing to stripekit

Thanks for your interest! stripekit is a small, focused tool — contributions that keep it that way are very welcome.

## Development setup

```bash
git clone https://github.com/rafaelcg/stripekit.git
cd stripekit
pnpm install
pnpm -C packages/stripekit build
```

Requires Node.js 20+ and pnpm.

## Common tasks

```bash
pnpm -C packages/stripekit test        # run the test suite
pnpm -C packages/stripekit typecheck   # type-check
pnpm -C packages/stripekit build       # bundle CLI + types
pnpm format                            # format with Prettier
pnpm docs:dev                          # preview the docs site
```

Try changes end to end with the playground:

```bash
cd examples/playground
cp .env.example .env.local   # add a Stripe TEST key
pnpm plan
```

## Guidelines

- **Add tests.** The reconciler is pure and well-covered — new behavior should come with tests (`packages/stripekit/test`). The in-memory `fake-stripe.ts` lets you test the whole loop without a network.
- **Correctness over features.** This tool mutates people's Stripe accounts and generates their billing code, so favor safety: archive over delete, replace over mutate, converge idempotently.
- **Keep it a tool, not a platform.** No hosted services, no runtime dependency on stripekit in generated code.
- **Run `pnpm format` and make sure `test` + `typecheck` pass** before opening a PR.

## Reporting bugs

Open an issue with the command you ran, what you expected, and what happened. For reconciliation bugs, the output of `stripekit plan --json` is especially helpful.
