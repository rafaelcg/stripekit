# Config reference

`stripe.config.ts` describes the desired state of your Stripe catalog. Author it with `defineConfig` for full type-checking and autocomplete:

```ts
import { defineConfig } from 'stripekit'

export default defineConfig({/* ... */})
```

## Keys

Every product key and price key must be **lowercase**, start with a letter, and contain only letters, numbers, and underscores (`/^[a-z][a-z0-9_]*$/`). A product key and price key are joined into a stable `lookup_key` — `pro` + `monthly` → `pro_monthly` — that your application code references. That combination must be unique across your whole config; stripekit rejects collisions.

## `products`

A map of product key → product. At least one product is required.

```ts
products: {
  pro: {
    name: 'Pro',                        // required — display name
    description: 'For growing teams',   // optional
    prices: { /* ... */ },              // required — at least one price
    features: { seats: 5 },             // optional — entitlements
    active: true,                       // optional — default true; set false to archive
    metadata: { tier: 'growth' },       // optional — extra Stripe metadata
  },
}
```

| Field         | Type                                          | Notes                                                                         |
| ------------- | --------------------------------------------- | ----------------------------------------------------------------------------- |
| `name`        | `string`                                      | **Required.** Product display name.                                           |
| `description` | `string`                                      | Optional marketing description.                                               |
| `prices`      | `Record<string, PriceConfig>`                 | **Required.** At least one price.                                             |
| `features`    | `Record<string, string \| number \| boolean>` | Stored in product metadata; read by the generated `hasFeature()` helper.      |
| `active`      | `boolean`                                     | Defaults to `true`. `false` archives the product.                             |
| `metadata`    | `Record<string, string>`                      | Merged onto the Stripe product. Keys starting with `stripekit_` are reserved. |

### `prices`

A map of price key → price.

```ts
prices: {
  monthly: { amount: 2000, currency: 'usd', interval: 'month' },
  yearly:  { amount: 19200, currency: 'usd', interval: 'year' },
  lifetime:{ amount: 9900, currency: 'usd' },   // no interval → one-time
}
```

| Field           | Type                                          | Notes                                                                                                              |
| --------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `amount`        | `number`                                      | **Required.** In the currency's minor unit — `2000` = $20.00. Immutable in Stripe; changing it triggers a replace. |
| `currency`      | `string`                                      | **Required.** 3-letter ISO-4217 code, e.g. `'usd'`.                                                                |
| `interval`      | `'day' \| 'week' \| 'month' \| 'year'`        | Recurring interval. **Omit for a one-time price.**                                                                 |
| `intervalCount` | `number`                                      | Intervals between charges. Defaults to `1`. Ignored for one-time prices.                                           |
| `nickname`      | `string`                                      | Label shown in the Stripe dashboard.                                                                               |
| `taxBehavior`   | `'inclusive' \| 'exclusive' \| 'unspecified'` | Once set to inclusive/exclusive it can't change (Stripe rule); stripekit replaces the price if you try.            |

### `features`

Feature entitlements are stored in the product's metadata (`stripekit_feature_*`) and surfaced by the generated `hasFeature(userId, key)` helper — plan-gating without a hosted control plane.

```ts
features: { seats: 5, projects: 'unlimited', priority_support: true }
```

## `webhooks`

```ts
webhooks: {
  path: '/api/stripe/webhook',   // required — your handler route
  events: ['checkout.session.completed', /* ... */], // optional — override the default set
}
```

The webhook endpoint is registered only when a deployment URL is available (`--url` or an env var like `NEXT_PUBLIC_APP_URL`). For local development use [`stripekit dev`](/cli/dev) to forward events instead. Omitting `events` uses the minimal set the generated handler processes.

## `portal`

Configure the Stripe customer portal, or set `false` to leave it unmanaged.

```ts
portal: {
  cancellations: true,       // allow subscription cancellation
  planSwitching: true,       // allow switching between your plans
  paymentMethodUpdate: true, // allow updating the payment method
  invoiceHistory: true,      // show invoice history
}
```

All four default to `true` when a `portal` object is present. Plan-switching requires that switchable prices share a single currency.

## `sync`

Which adapter the generated code uses to persist synced customer state.

```ts
sync: {
  adapter: 'drizzle'
} // 'drizzle' | 'kv' | 'prisma'
```

Consumed by [`stripekit init`](/cli/init) when scaffolding the storage layer.
