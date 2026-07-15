/**
 * The minimal set of webhook events the generated handler actually processes.
 * Mirrors the "How I Stay Sane Implementing Stripe" event list: everything
 * needed to keep a single synced customer-state record correct, and nothing else.
 */
export const DEFAULT_WEBHOOK_EVENTS: readonly string[] = [
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
]

/** Environment variable names stripekit reads/writes, in priority order. */
export const ENV = {
  secretKey: ['STRIPE_SECRET_KEY'],
  publishableKey: ['STRIPE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'],
  webhookSecret: ['STRIPE_WEBHOOK_SECRET'],
  portalConfigId: ['STRIPE_PORTAL_CONFIGURATION_ID'],
  appUrl: ['STRIPEKIT_APP_URL', 'NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_SITE_URL', 'VERCEL_URL'],
} as const
