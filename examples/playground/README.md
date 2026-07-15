# stripekit playground

A scratch project for trying stripekit against a Stripe **test** account. Nothing here touches live mode.

## Setup (once)

From the repo root, make sure everything is installed and built:

```bash
pnpm install
pnpm -C packages/stripekit build
```

Then add your Stripe test key:

```bash
cd examples/playground
cp .env.example .env.local
# edit .env.local and paste your key from https://dashboard.stripe.com/test/apikeys
```

## Try it

```bash
pnpm plan     # preview what push would create — changes nothing
pnpm push     # create the products/prices/portal in your Stripe test account
pnpm push     # run again → "No changes." (idempotent)
pnpm pull     # regenerate stripe.config.ts from the account
```

After `push`, open <https://dashboard.stripe.com/test/products> to see what it created. Then edit an amount in `stripe.config.ts`, run `pnpm plan`, and watch it plan a price replacement (new price + moved lookup key + archived old).

> The `pnpm plan`/`push`/`pull` scripts call the `stripekit` binary from the workspace, so you don't need a global install.
