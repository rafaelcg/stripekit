<template>
  <section class="compare-section">
    <h2 class="compare-title">Adding subscriptions to your app</h2>
    <div class="compare">
      <div class="compare-col compare-hard">
        <div class="compare-head">
          <span class="compare-tag">Stripe, by hand</span>
          <span class="compare-meta">≈ a day · fingers crossed</span>
        </div>
        <ul>
          <li>
            <span class="mark x">✕</span> Create every product and price by hand in the dashboard
          </li>
          <li>
            <span class="mark x">✕</span> Paste fragile <code>price_1Qx…</code> IDs into your code
          </li>
          <li>
            <span class="mark x">✕</span> Write the checkout, webhook, and billing-portal code
            yourself
          </li>
          <li>
            <span class="mark x">✕</span> Get the webhook logic exactly right — or silently break
            who has access
          </li>
          <li><span class="mark x">✕</span> Redo it every time you change a price</li>
          <li><span class="mark x">✕</span> Cross your fingers and ship</li>
        </ul>
      </div>
      <div class="compare-col compare-easy">
        <div class="compare-head">
          <span class="compare-tag">With stripekit</span>
          <span class="compare-meta">≈ 2 minutes · done right</span>
        </div>
        <ul>
          <li><span class="mark c">✓</span> Write your plans in one small file</li>
          <li><span class="mark c">✓</span> Your app never touches a price ID again</li>
          <li>
            <span class="mark c">✓</span> Checkout, webhooks, and the customer portal — generated
            for you
          </li>
          <li>
            <span class="mark c">✓</span> The webhook logic everyone gets wrong: written correctly
          </li>
          <li><span class="mark c">✓</span> Change a price? Edit the file, run one command</li>
          <li>
            <span class="mark c">✓</span> Real Stripe code that lives in your repo — yours to own
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
