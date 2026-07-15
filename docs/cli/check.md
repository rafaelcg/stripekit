# stripekit check

A doctor that verifies your stripekit setup is healthy — keys, config, drift, and webhook/portal wiring — in one command.

```bash
npx stripekit check
```

```
stripekit check

  ✓ Stripe key (test mode)
  ✓ stripe.config.ts — 2 product(s)
  ✓ Config vs. account — in sync
  ✓ Webhook endpoint — https://app.example.com/api/stripe/webhook
  ✓ Customer portal

✓ Looks good.
```

## What it checks

| Check                  | Passes when                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| **Stripe key**         | `STRIPE_SECRET_KEY` is present, well-formed, and accepted by Stripe (reports test vs live mode). |
| **stripe.config.ts**   | The config file exists and validates.                                                            |
| **Config vs. account** | Your account matches the config — no pending `push`. Warns with the count if it's drifted.       |
| **Webhook endpoint**   | A managed webhook endpoint exists and `STRIPE_WEBHOOK_SECRET` is set.                            |
| **Customer portal**    | A managed portal configuration exists and `STRIPE_PORTAL_CONFIGURATION_ID` is set.               |

Each check reports `✓` ok, `!` warning, or `✗` failure. `check` exits non-zero if any check fails, so it's useful in CI.

## Options

| Flag          | Description                                                            |
| ------------- | ---------------------------------------------------------------------- |
| `--json`      | Machine-readable output: `{ ok, items: [{ label, status, detail }] }`. |
| `--url <url>` | Base URL used when checking the webhook endpoint.                      |

## Fail-fast order

Checks run most-fundamental first and stop early on a hard failure — no key means no point checking drift. Fix failures top to bottom.
