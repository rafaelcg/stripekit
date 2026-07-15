import { stripe } from '@/lib/stripe/client'
import { syncStripeCustomerState } from '@/lib/stripe/sync'

// Node runtime: signature verification needs Node crypto, and stripe-node isn't
// edge-safe. (This is the default in Next 15/16, but pin it to be safe.)
export const runtime = 'nodejs'

// Events that change a customer's billing state. Everything else is acked and
// ignored. syncStripeCustomerState is idempotent, so duplicate/out-of-order
// deliveries are harmless — no event-dedup table required.
const RELEVANT = new Set<string>([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
  'customer.subscription.pending_update_applied',
  'customer.subscription.pending_update_expired',
  'customer.subscription.trial_will_end',
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.payment_action_required',
  'invoice.marked_uncollectible',
  'invoice.payment_succeeded',
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'payment_intent.canceled',
])

export async function POST(request: Request): Promise<Response> {
  // A missing secret is a *server* misconfiguration, not a bad request. Return
  // 5xx so Stripe retries once it's fixed — a 400 here would drop every event
  // permanently and silently.
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    console.error('[stripe webhook] STRIPE_WEBHOOK_SECRET is not set')
    return new Response('Webhook secret not configured', { status: 500 })
  }

  // Verify against the RAW body — never req.json(), which loses the exact bytes.
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')
  if (!signature) return new Response('Missing stripe-signature', { status: 400 })

  let event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, secret)
  } catch {
    // Bad signature is a permanent 400 — Stripe should not keep retrying it.
    return new Response('Invalid signature', { status: 400 })
  }

  if (RELEVANT.has(event.type)) {
    try {
      const customerId = extractCustomerId(event.data.object)
      if (customerId) await syncStripeCustomerState(customerId)
    } catch (error) {
      // Return 5xx so Stripe retries; the sync is idempotent so retries are safe.
      console.error('[stripe webhook] failed to process', event.type, error)
      return new Response('Webhook handler error', { status: 500 })
    }
  }

  return new Response(null, { status: 200 })
}

function extractCustomerId(object: unknown): string | null {
  if (object && typeof object === 'object' && 'customer' in object) {
    const customer = (object as { customer: unknown }).customer
    if (typeof customer === 'string') return customer
    if (customer && typeof customer === 'object' && 'id' in customer) {
      const id = (customer as { id: unknown }).id
      if (typeof id === 'string') return id
    }
  }
  return null
}
