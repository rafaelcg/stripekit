# How it works

stripekit is a **reconciler**. You describe the desired state of your catalog in `stripe.config.ts`; stripekit reads the current state of your Stripe account, computes the difference, and applies the minimal set of changes to close the gap — like Terraform, but for Stripe products, prices, the webhook endpoint, and the customer portal.

## The loop

```
stripe.config.ts ──▶ desired state ─┐
                                    ├──▶ diff ──▶ plan ──▶ apply
Stripe account ────▶ current state ─┘
```

Every step is deterministic. Given the same config and account, `plan` always prints the same plan, and applying it always converges: run `push` twice and the second run reports **No changes**.

## It only ever touches what it created

Every object stripekit manages is tagged — prices carry a stable `lookup_key`, and products, prices, webhook endpoints, and portal configs carry `stripekit_*` metadata. Reconciliation reads and writes **only** tagged objects.

Anything you created by hand in the Stripe dashboard is invisible to stripekit and is never modified or archived. That safety is by construction, not by convention.

## Prices are immutable

Stripe prices can't have their amount, currency, or interval changed. So when you edit a price in config, stripekit doesn't attempt an illegal update — it:

1. Creates a **new** price with the new amount,
2. Atomically moves the `lookup_key` onto it (`transfer_lookup_key`),
3. Archives the old price.

Your application code references the **lookup key** (`pro_monthly`), never a price ID — so it keeps working across the swap. Existing subscriptions continue on their original price until they renew or you migrate them; stripekit never disrupts them.

## Archive, never delete

Removing a product or price from config **archives** it (`active: false`). Stripe forbids deleting prices that have ever been used, and archiving is reversible — re-add the item to config and stripekit reactivates it rather than creating a duplicate.

## One config, two modes

Test and live are just two targets of the same file. You develop against `sk_test_…`, and `push --live` promotes the identical catalog to production. There's no separate "production config" to drift out of sync.

## Idempotent and crash-safe

Every create carries a stable idempotency key derived from its content, so re-running after a failure never double-creates. If a run is interrupted mid-replace, the next `plan` detects the stray and heals it. Rate limits are retried with backoff.

## Built for agents, too

Because the whole thing is a deterministic CLI with `--json` and `--yes`, an AI coding agent runs the exact same commands you do and gets the exact same result. There's no dashboard clicking to automate and no webhook handler to hallucinate — the correctness lives in the tool.
