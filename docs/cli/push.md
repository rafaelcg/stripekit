# stripekit push

Reconcile your Stripe account to match `stripe.config.ts` — creating and updating products, prices, the webhook endpoint, and the customer portal.

```bash
npx stripekit push
```

`push` prints the plan, applies it, and (idempotently) reports **No changes** on a second run.

## Test vs live

The mode is inferred from your key's prefix:

- **`sk_test_…`** → test mode. `push` applies directly.
- **`sk_live_…`** → live mode. `push` **refuses** unless you pass `--live`, then asks for confirmation.

```bash
# apply to test mode
npx stripekit push

# promote the same catalog to live mode
STRIPE_SECRET_KEY=sk_live_... npx stripekit push --live
```

## Options

| Flag          | Description                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------------- |
| `--dry-run`   | Show the plan without applying (same as `stripekit plan`).                                     |
| `--live`      | Required to apply changes to a live-mode account.                                              |
| `-y, --yes`   | Skip the interactive confirmation prompt (needed for CI; combine with `--live` for live mode). |
| `--json`      | Machine-readable output. In live JSON mode, both `--live` and `--yes` are required.            |
| `--url <url>` | Base URL used to register the webhook endpoint.                                                |

## What it writes back

When `push` creates the webhook endpoint or the portal configuration, it writes the resulting values to your env file (`.env.local` if present, else `.env`):

- `STRIPE_WEBHOOK_SECRET` — the signing secret, which Stripe only returns at creation time.
- `STRIPE_PORTAL_CONFIGURATION_ID` — the managed portal configuration, passed explicitly by the generated portal route.

## Webhook registration

The webhook endpoint is registered only when a deployment URL is available (via `--url` or an env var such as `NEXT_PUBLIC_APP_URL`). Without one, `push` skips the webhook and tells you — use the Stripe CLI to forward events during local development.

## Safety

- Only stripekit-managed objects are touched; hand-made products are invisible to it.
- Prices are replaced (never mutated) and removed items are archived (never deleted).
- Every create carries a stable idempotency key, so a re-run after a failure won't double-create.
