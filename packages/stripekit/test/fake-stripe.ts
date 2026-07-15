import type Stripe from 'stripe'

/* A tiny in-memory stand-in for the subset of the Stripe API the reconciler
 * uses. It mirrors the behaviors that matter for correctness: transfer_lookup_key
 * atomically moves a key off the active price that holds it, metadata keys are
 * cleared by posting '', list endpoints filter by product/active, and webhook
 * creation returns a one-time signing secret. */

interface FakeProduct {
  id: string
  object: 'product'
  active: boolean
  name: string
  description: string | null
  metadata: Record<string, string>
  default_price: string | null
}
interface FakePrice {
  id: string
  object: 'price'
  product: string
  active: boolean
  currency: string
  unit_amount: number | null
  recurring: { interval: string; interval_count: number } | null
  lookup_key: string | null
  nickname: string | null
  tax_behavior: string | null
  metadata: Record<string, string>
}
interface FakeWebhook {
  id: string
  object: 'webhook_endpoint'
  url: string
  enabled_events: string[]
  metadata: Record<string, string>
  secret: string
  description: string | null
}
interface FakePortal {
  id: string
  object: 'billing_portal.configuration'
  features: unknown
  metadata: Record<string, string>
  is_default: boolean
  active: boolean
}

export interface FakeState {
  products: FakeProduct[]
  prices: FakePrice[]
  webhookEndpoints: FakeWebhook[]
  portalConfigs: FakePortal[]
}

export interface FakeStripe {
  stripe: Stripe
  state: FakeState
}

export function createFakeStripe(seed: Partial<FakeState> = {}): FakeStripe {
  const state: FakeState = {
    products: seed.products ?? [],
    prices: seed.prices ?? [],
    webhookEndpoints: seed.webhookEndpoints ?? [],
    portalConfigs: seed.portalConfigs ?? [],
  }
  let counter = 0
  const nextId = (prefix: string) => `${prefix}_${++counter}`

  async function* iterate<T>(items: T[]): AsyncGenerator<T> {
    for (const item of [...items]) yield item
  }

  const applyMetadata = (target: Record<string, string>, updates: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(updates)) {
      if (v === '') delete target[k]
      else target[k] = String(v)
    }
  }

  const api = {
    products: {
      list: (params: { active?: boolean } = {}) =>
        iterate(
          state.products.filter((p) => params.active === undefined || p.active === params.active),
        ),
      create: async (params: any): Promise<FakeProduct> => {
        const product: FakeProduct = {
          id: nextId('prod'),
          object: 'product',
          active: params.active ?? true,
          name: params.name,
          description: params.description ?? null,
          metadata: { ...(params.metadata ?? {}) },
          default_price: null,
        }
        state.products.push(product)
        return product
      },
      update: async (id: string, params: any): Promise<FakeProduct> => {
        const product = state.products.find((p) => p.id === id)
        if (!product) throw new Error(`no such product ${id}`)
        if (params.name !== undefined) product.name = params.name
        if (params.active !== undefined) product.active = params.active
        if (params.description !== undefined)
          product.description = params.description === '' ? null : params.description
        if (params.metadata) applyMetadata(product.metadata, params.metadata)
        return product
      },
    },
    prices: {
      list: (params: { product?: string; active?: boolean; lookup_keys?: string[] } = {}) =>
        iterate(
          state.prices.filter(
            (p) =>
              (params.product === undefined || p.product === params.product) &&
              (params.active === undefined || p.active === params.active) &&
              (!params.lookup_keys ||
                (p.lookup_key !== null && params.lookup_keys.includes(p.lookup_key))),
          ),
        ),
      create: async (params: any): Promise<FakePrice> => {
        if (params.transfer_lookup_key && params.lookup_key) {
          const holder = state.prices.find((p) => p.active && p.lookup_key === params.lookup_key)
          if (holder) holder.lookup_key = null
        }
        const price: FakePrice = {
          id: nextId('price'),
          object: 'price',
          product: params.product,
          active: true,
          currency: params.currency,
          unit_amount: params.unit_amount ?? null,
          recurring: params.recurring
            ? {
                interval: params.recurring.interval,
                interval_count: params.recurring.interval_count ?? 1,
              }
            : null,
          lookup_key: params.lookup_key ?? null,
          nickname: params.nickname ?? null,
          tax_behavior: params.tax_behavior ?? null,
          metadata: { ...(params.metadata ?? {}) },
        }
        state.prices.push(price)
        return price
      },
      update: async (id: string, params: any): Promise<FakePrice> => {
        const price = state.prices.find((p) => p.id === id)
        if (!price) throw new Error(`no such price ${id}`)
        if (params.transfer_lookup_key && params.lookup_key) {
          const holder = state.prices.find(
            (p) => p.active && p.lookup_key === params.lookup_key && p.id !== id,
          )
          if (holder) holder.lookup_key = null
        }
        if (params.active !== undefined) price.active = params.active
        if (params.nickname !== undefined)
          price.nickname = params.nickname === '' ? null : params.nickname
        if (params.lookup_key !== undefined) price.lookup_key = params.lookup_key
        if (params.tax_behavior !== undefined) price.tax_behavior = params.tax_behavior
        if (params.metadata) applyMetadata(price.metadata, params.metadata)
        return price
      },
    },
    webhookEndpoints: {
      list: () => iterate(state.webhookEndpoints),
      create: async (params: any): Promise<FakeWebhook> => {
        const endpoint: FakeWebhook = {
          id: nextId('we'),
          object: 'webhook_endpoint',
          url: params.url,
          enabled_events: params.enabled_events,
          metadata: { ...(params.metadata ?? {}) },
          secret: nextId('whsec'),
          description: params.description ?? null,
        }
        state.webhookEndpoints.push(endpoint)
        return endpoint
      },
      update: async (id: string, params: any): Promise<FakeWebhook> => {
        const endpoint = state.webhookEndpoints.find((w) => w.id === id)
        if (!endpoint) throw new Error(`no such webhook ${id}`)
        if (params.url !== undefined) endpoint.url = params.url
        if (params.enabled_events !== undefined) endpoint.enabled_events = params.enabled_events
        return endpoint
      },
    },
    billingPortal: {
      configurations: {
        list: () => iterate(state.portalConfigs),
        create: async (params: any): Promise<FakePortal> => {
          const config: FakePortal = {
            id: nextId('bpc'),
            object: 'billing_portal.configuration',
            features: params.features,
            metadata: { ...(params.metadata ?? {}) },
            is_default: false,
            active: true,
          }
          state.portalConfigs.push(config)
          return config
        },
        update: async (id: string, params: any): Promise<FakePortal> => {
          const config = state.portalConfigs.find((c) => c.id === id)
          if (!config) throw new Error(`no such portal config ${id}`)
          if (params.features) config.features = params.features
          if (params.metadata) config.metadata = { ...(params.metadata ?? {}) }
          return config
        },
      },
    },
  }

  return { stripe: api as unknown as Stripe, state }
}
