# stripekit plan

Preview the changes `push` would make. **Never mutates anything** — it's a read-only dry run.

```bash
npx stripekit plan
```

```
stripekit — reconciling test mode

  + product "pro" — Pro
  + price "pro_monthly" — 20.00 USD / month
  ~ price "pro_yearly" — nickname
  ± price "team_monthly" — amount changed; recreate + move lookup key + archive old
  - price "legacy_monthly" — archive

Plan: 1 to create, 1 to update, 1 to replace, 1 to archive.
```

Symbols mirror the effect: `+` create, `~` update in place, `±` replace (for immutable price changes), `-` archive.

## Options

| Flag          | Description                                                                    |
| ------------- | ------------------------------------------------------------------------------ |
| `--json`      | Machine-readable output (for agents / CI). Emits `{ mode, summary, actions }`. |
| `--url <url>` | Base URL used when planning the webhook endpoint.                              |

## Notes

- The mode (test vs live) is inferred from your `STRIPE_SECRET_KEY` prefix.
- `plan` reads only stripekit-managed objects — products you created by hand are never shown or touched.
- `stripekit push --dry-run` is equivalent.
