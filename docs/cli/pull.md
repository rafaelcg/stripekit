# stripekit pull

Generate `stripe.config.ts` from your existing Stripe catalog. **Read-only** — it never mutates Stripe. Use it to adopt an account you already have.

```bash
npx stripekit pull
```

This reads every active product and price on the account and writes a `stripe.config.ts` you can review and start managing.

## Options

| Flag               | Description                                            |
| ------------------ | ------------------------------------------------------ |
| `-o, --out <file>` | Output path. Defaults to `stripe.config.ts`.           |
| `--stdout`         | Print the config to stdout instead of writing a file.  |
| `--json`           | Emit `{ productCount, priceCount, warnings, source }`. |
| `-y, --yes`        | Overwrite an existing config without prompting.        |

## What it can't represent

Some Stripe prices don't map to stripekit's simple per-unit model. `pull` **skips** them rather than guessing, and reports each as a warning:

- Prices with no fixed `unit_amount` (tiered or decimal-only pricing).
- Products left with no representable price (they'd fail the "at least one price" rule).

Everything it can represent — including `tax_behavior` — round-trips: pulling and then pushing reproduces the same catalog.

## Adopting an existing account

`pull` gives you a config as a **starting point**. Review the generated keys (they become your stable `lookup_key`s), then run `stripekit plan` to see how reconciliation would proceed.
