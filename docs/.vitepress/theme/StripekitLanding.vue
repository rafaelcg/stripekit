<script setup lang="ts">
import { onMounted } from 'vue'

// Copy-to-clipboard for the command chips, with a brief ✓ confirmation.
onMounted(() => {
  document.querySelectorAll<HTMLElement>('.term .copy').forEach((el) => {
    el.addEventListener('click', () => {
      const text = el.getAttribute('data-copy')
      if (!text || !navigator.clipboard) return
      navigator.clipboard
        .writeText(text)
        .then(() => {
          const ic = el.querySelector<HTMLElement>('.copy-ic')
          if (!ic) return
          const prev = ic.textContent
          ic.textContent = '✓'
          ic.style.color = '#3fb950'
          setTimeout(() => {
            ic.textContent = prev
            ic.style.color = ''
          }, 1300)
        })
        .catch(() => {})
    })
  })
})
</script>

<template>
  <div class="term" id="top">
    <!-- NAV -->
    <header class="nav">
      <div class="nav-in">
        <a class="mark" href="#top"><span class="mark-dot"></span>stripekit</a>
        <nav class="nav-links">
          <a href="#flow">flow</a>
          <a href="#config">config</a>
          <a href="#agents">agents</a>
          <a href="/guide/getting-started">docs</a>
          <button class="npm copy" data-copy="npm i -D stripekit">
            <span class="p">$</span> npm i -D stripekit <span class="copy-ic">⧉</span>
          </button>
          <a class="gh" href="https://github.com/rafaelcg/stripekit">GitHub <span>↗</span></a>
        </nav>
      </div>
    </header>

    <main>
      <!-- HERO -->
      <section class="hero">
        <div class="glow" aria-hidden="true"></div>
        <div class="hero-grid">
          <div class="hero-copy">
            <div class="kicker">// the create-next-app of Stripe</div>
            <h1 class="h1">Your Stripe account,<br />in one&nbsp;file.</h1>
            <p class="lede">
              Declare your catalog in <code>stripe.config.ts</code>. stripekit sets up your Stripe
              account to match — and gives you billing code you own.
            </p>
            <div class="cta">
              <a class="btn primary" href="/guide/getting-started">Get started</a>
              <button class="run copy" data-copy="npx stripekit init">
                <span class="p">$</span> npx stripekit init<span class="copy-ic">⧉</span>
              </button>
            </div>
            <div class="meta">
              MIT licensed<span class="d">·</span>works with Next.js<span class="d">·</span>v0.2.1
            </div>
          </div>

          <div class="hero-term">
            <div
              class="win"
              role="img"
              aria-label="Terminal running stripekit push and printing a plan diff"
            >
              <div class="win-bar">
                <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
                <span class="win-title">stripekit push</span>
              </div>
              <pre class="win-body"><span class="cmd">$ stripekit push</span>
<span class="dim">Plan: 3 to create, 1 to replace, 0 to destroy</span>

  <span class="add">+ product</span>   Pro
  <span class="add">+ price</span>     pro_monthly     $20.00 / month
  <span class="chg">~ price</span>     pro_yearly      <span class="old">$192</span> → <span class="new">$160</span> / year  <span class="dim">(replace)</span>
  <span class="add">+ webhook</span>   /api/stripe/webhook   <span class="dim">12 events</span>
  <span class="add">+ portal</span>    cancellations, plan switching

<span class="dim">Apply these changes?</span> <span class="amb">›</span> <span class="you">yes</span>
<span class="ok">✓</span> Applied in 1.4s — account matches config<span class="caret">▍</span></pre>
            </div>
          </div>
        </div>
      </section>

      <!-- FLOW -->
      <section class="sec" id="flow">
        <div class="kicker">// zero to paid</div>
        <h2 class="h2">Three commands, start to finish.</h2>
        <div class="steps">
          <div class="panel step">
            <div class="step-top">
              <span class="idx">01</span><span class="step-cmd">$ stripekit init</span>
            </div>
            <p>
              Scaffold <code>stripe.config.ts</code> and correct-by-construction billing code into
              your Next.js app.
            </p>
          </div>
          <div class="panel step">
            <div class="step-top">
              <span class="idx">02</span><span class="step-cmd">$ stripekit plan</span>
            </div>
            <p>
              Preview a terraform-style diff of every product, price, and webhook change — before
              anything moves.
            </p>
          </div>
          <div class="panel step">
            <div class="step-top">
              <span class="idx">03</span><span class="step-cmd">$ stripekit push</span>
            </div>
            <p>
              Create the products, prices, webhook endpoint, and portal. Idempotent — run it twice,
              nothing breaks.
            </p>
          </div>
        </div>
      </section>

      <!-- CONFIG -->
      <section class="sec" id="config">
        <div class="config-grid">
          <div class="config-copy">
            <div class="kicker">// your catalog, as code</div>
            <h2 class="h2">One file is the source of truth.</h2>
            <p class="body">
              Change an amount and run <code>push</code> — stripekit mints the new price, moves the
              lookup key onto it, and archives the old one. Your checkout code never changes,
              because it references the stable lookup key, not a price ID.
            </p>
            <ul class="ticks">
              <li>Prices replaced, never mutated</li>
              <li>Removals archived, never deleted</li>
              <li>The same file targets test and live</li>
            </ul>
          </div>
          <div class="win editor">
            <div class="win-bar">
              <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
              <span class="win-title">stripe.config.ts</span>
            </div>
            <pre
              class="win-body code"
            ><span class="k">import</span> { defineConfig } <span class="k">from</span> <span class="s">'stripekit'</span>

<span class="k">export default</span> <span class="f">defineConfig</span>({
  products: {
    pro: {
      name: <span class="s">'Pro'</span>,
      prices: {
        monthly: { amount: <span class="n">2000</span>,  interval: <span class="s">'month'</span> },
        yearly:  { amount: <span class="n">19200</span>, interval: <span class="s">'year'</span> },
      },
      features: { seats: <span class="n">5</span>, projects: <span class="s">'unlimited'</span> },
    },
  },
  portal:   { cancellations: <span class="k">true</span>, planSwitching: <span class="k">true</span> },
  webhooks: { path: <span class="s">'/api/stripe/webhook'</span> },
})</pre>
          </div>
        </div>
      </section>

      <!-- WHY -->
      <section class="sec" id="why">
        <div class="kicker">// why teams pick it</div>
        <h2 class="h2">Correct by construction.</h2>
        <div class="cards">
          <div class="panel card">
            <span class="ico" aria-hidden="true"
              ><svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
              >
                <circle cx="8" cy="8" r="4.5" />
                <path d="M11 11l7 7M15 15l2-2M18 18l2-2" /></svg
            ></span>
            <h3>Your Stripe, not ours</h3>
            <p>
              Not a merchant of record. Not a hosted control plane. State lives in your own database
              — there's nothing to depend on at runtime.
            </p>
          </div>
          <div class="panel card">
            <span class="ico" aria-hidden="true"
              ><svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
              >
                <path d="M9 3v6M15 3v6M7 9h10v3a5 5 0 01-10 0z M12 17v4" /></svg
            ></span>
            <h3>Webhooks that can't corrupt state</h3>
            <p>
              The generated handler verifies signatures, dedupes events, and funnels everything
              through one sync function — so out-of-order delivery can't wreck you.
            </p>
          </div>
          <div class="panel card">
            <span class="ico" aria-hidden="true"
              ><svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
              >
                <path d="M20 12a8 8 0 10-2.3 5.6M20 7v5h-5" /></svg
            ></span>
            <h3>Idempotent &amp; immutable-safe</h3>
            <p>
              Prices are replaced, never mutated. Removals are archived, never deleted. Apply a
              plan, re-plan, and you get zero changes.
            </p>
          </div>
          <div class="panel card">
            <span class="ico" aria-hidden="true"
              ><svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
              >
                <path d="M4 8h10M18 8h2M4 16h4M12 16h8" />
                <circle cx="16" cy="8" r="2.4" />
                <circle cx="9" cy="16" r="2.4" /></svg
            ></span>
            <h3>One config, test &amp; live</h3>
            <p>
              The same file targets both modes. <code>push --live</code> promotes your catalog —
              which is what kills test/live drift for good.
            </p>
          </div>
        </div>
      </section>

      <!-- AGENTS -->
      <section class="sec" id="agents">
        <div class="panel agent">
          <div class="agent-copy">
            <div class="kicker">// or hand it to your agent</div>
            <h2 class="h2">Same tool. One click for your agent.</h2>
            <p class="body">
              No wrapper, no glue code. stripekit runs as an MCP server, so your coding agent calls
              <code>plan</code> / <code>push</code> / <code>pull</code> /
              <code>check</code> directly — and can't hallucinate a webhook handler.
            </p>
            <p class="registry">
              Published to the <strong>MCP registry</strong> as
              <code>io.github.rafaelcg/stripekit</code>. <a href="/cli/mcp">Full setup →</a>
            </p>
          </div>
          <div class="agent-actions">
            <a
              class="install cursor"
              href="cursor://anysphere.cursor-deeplink/mcp/install?name=stripekit&amp;config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsInN0cmlwZWtpdEBsYXRlc3QiLCJtY3AiXX0="
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M5 3l14 8-6 1.4L9 20 5 3z" fill="currentColor" />
              </svg>
              Add to Cursor
            </a>
            <div class="cc">
              <div class="cc-bar"><span class="cc-dot"></span>Claude Code</div>
              <pre
                class="cc-code copy"
                data-copy="/plugin marketplace add rafaelcg/stripekit&#10;/plugin install stripekit@stripekit-marketplace"
              ><span class="cc-cmd">/plugin</span> marketplace add rafaelcg/stripekit
<span class="cc-cmd">/plugin</span> install stripekit@stripekit-marketplace<span class="copy-ic"> ⧉</span></pre>
            </div>
          </div>
        </div>
      </section>

      <!-- FOOTER -->
      <footer class="foot">
        <div class="foot-in">
          <div class="foot-l">
            <a class="mark" href="#top"><span class="mark-dot"></span>stripekit</a>
            <p>
              Built on the ideas behind
              <a href="https://github.com/t3dotgg/stripe-recommendations"
                >“How I Stay Sane Implementing Stripe”</a
              >
              — turned into a tool.
            </p>
          </div>
          <div class="foot-r">
            <a href="/guide/getting-started">Docs</a>
            <a href="https://github.com/rafaelcg/stripekit">GitHub</a>
            <a href="https://www.npmjs.com/package/stripekit">npm</a>
            <a href="https://github.com/rafaelcg/stripekit/blob/main/LICENSE">MIT</a>
          </div>
        </div>
      </footer>
    </main>
  </div>
</template>

<style>
.term {
  --bg: #0a0c11;
  --bg-2: #0e1117;
  --panel: #101520;
  --panel-2: #131926;
  --line: #1e2532;
  --line-2: #2a3345;
  --ink: #e7eaf0;
  --dim: #9aa3b2;
  --faint: #626b7c;
  --green: #3fb950;
  --green-2: #56d364;
  --purple: #8b80ff;
  --amber: #e3b341;
  font-family:
    system-ui,
    -apple-system,
    'Segoe UI',
    Roboto,
    Helvetica,
    Arial,
    sans-serif;
  background: var(--bg);
  color: var(--ink);
  min-height: 100vh;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
.term *,
.term *::before,
.term *::after {
  box-sizing: border-box;
}
.term p,
.term h1,
.term h2,
.term h3,
.term ul {
  margin: 0;
}
.term ::selection {
  background: rgba(63, 185, 80, 0.28);
}
.term code,
.term .kicker,
.term .run,
.term .npm,
.term .step-cmd,
.term .win-body,
.term .win-title,
.term .mark,
.term .meta,
.term .cc-code,
.term .cc-bar,
.term .idx {
  font-family:
    ui-monospace, 'JetBrains Mono', 'SF Mono', 'Cascadia Code', Menlo, Consolas, monospace;
}
.term a {
  text-decoration: none;
  color: inherit;
}
.term :is(h1, h2, h3) {
  letter-spacing: -0.025em;
  font-weight: 640;
  text-wrap: balance;
}
.term :focus-visible {
  outline: 2px solid var(--green);
  outline-offset: 3px;
  border-radius: 4px;
}
.term .kicker {
  color: var(--green);
  font-size: 12.5px;
  letter-spacing: 0.04em;
}
.term code {
  font-size: 0.9em;
  color: #cdd4e0;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--line);
  border-radius: 5px;
  padding: 0.05em 0.38em;
}

/* NAV */
.term .nav {
  position: sticky;
  top: 0;
  z-index: 40;
  background: color-mix(in srgb, var(--bg) 78%, transparent);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--line);
}
.term .nav-in {
  max-width: 1180px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 13px clamp(16px, 4vw, 36px);
  gap: 16px;
}
.term .mark {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  letter-spacing: -0.01em;
}
.term .mark-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--green);
  box-shadow: 0 0 9px var(--green);
}
.term .nav-links {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.term .nav-links a {
  color: var(--dim);
  font-size: 13.5px;
  padding: 6px 10px;
  border-radius: 7px;
  transition:
    color 0.16s,
    background 0.16s;
}
.term .nav-links a:hover {
  color: var(--ink);
  background: rgba(255, 255, 255, 0.04);
}
.term .npm {
  cursor: pointer;
  font-size: 12.5px;
  color: var(--dim);
  background: var(--bg-2);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 7px 11px;
  transition:
    border-color 0.16s,
    color 0.16s;
}
.term .npm:hover {
  border-color: var(--line-2);
  color: var(--ink);
}
.term .npm .p,
.term .run .p {
  color: var(--green);
  margin-right: 5px;
}
.term .copy-ic {
  color: var(--faint);
  margin-left: 8px;
  font-size: 12px;
}
.term .nav-links .gh {
  border: 1px solid var(--line);
  color: var(--ink);
}
.term .nav-links .gh:hover {
  border-color: var(--line-2);
  background: transparent;
}
.term .nav-links .gh span {
  color: var(--dim);
}

/* HERO */
.term .hero {
  position: relative;
  max-width: 1180px;
  margin: 0 auto;
  padding: clamp(48px, 8vw, 104px) clamp(16px, 4vw, 36px) clamp(40px, 6vw, 72px);
  overflow: hidden;
}
.term .glow {
  position: absolute;
  top: -30%;
  left: 30%;
  width: 60%;
  height: 90%;
  pointer-events: none;
  background:
    radial-gradient(50% 50% at 50% 50%, rgba(63, 185, 80, 0.1), transparent 70%),
    radial-gradient(40% 40% at 75% 30%, rgba(99, 91, 255, 0.12), transparent 70%);
  filter: blur(10px);
}
.term .hero-grid {
  position: relative;
  display: grid;
  grid-template-columns: 1.02fr 1fr;
  gap: clamp(32px, 5vw, 64px);
  align-items: center;
}
.term .h1 {
  margin-top: 18px;
  font-size: clamp(34px, 5.4vw, 62px);
  line-height: 1.05;
  color: #fff;
  font-weight: 660;
}
.term .lede {
  margin-top: 22px;
  max-width: 52ch;
  color: var(--dim);
  font-size: clamp(15.5px, 1.4vw, 17.5px);
}
.term .lede code {
  color: var(--amber);
}
.term .cta {
  margin-top: 30px;
  display: flex;
  align-items: stretch;
  gap: 14px;
  flex-wrap: wrap;
}
.term .btn {
  display: inline-flex;
  align-items: center;
  font-size: 14.5px;
  font-weight: 600;
  border-radius: 9px;
  padding: 12px 22px;
  border: 1px solid transparent;
  transition:
    transform 0.14s,
    box-shadow 0.14s,
    background 0.14s;
}
.term .btn.primary {
  background: var(--ink);
  color: #0a0c11;
  box-shadow: 0 8px 30px -12px rgba(231, 234, 240, 0.4);
}
.term .btn.primary:hover {
  transform: translateY(-2px);
  background: #fff;
}
.term .run {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  font-size: 13.5px;
  color: var(--ink);
  background: var(--bg-2);
  border: 1px solid var(--line);
  border-radius: 9px;
  padding: 12px 16px;
  transition: border-color 0.16s;
}
.term .run:hover {
  border-color: var(--line-2);
}
.term .meta {
  margin-top: 22px;
  color: var(--faint);
  font-size: 12.5px;
  letter-spacing: 0.02em;
}
.term .meta .d {
  margin: 0 9px;
  color: var(--line-2);
}
.term .caret {
  color: var(--green);
  animation: term-blink 1.15s step-end infinite;
  margin-left: 1px;
}
@keyframes term-blink {
  50% {
    opacity: 0;
  }
}

/* WINDOW */
.term .win {
  background: linear-gradient(180deg, var(--panel), var(--bg-2));
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
  box-shadow:
    0 40px 90px -40px rgba(0, 0, 0, 0.85),
    0 0 0 1px rgba(139, 128, 255, 0.05);
}
.term .win-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 15px;
  background: #0c0f16;
  border-bottom: 1px solid var(--line);
}
.term .win-bar .dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  opacity: 0.9;
}
.term .win-bar .dot.r {
  background: #ec6a5e;
}
.term .win-bar .dot.y {
  background: #f4bf4f;
}
.term .win-bar .dot.g {
  background: #61c554;
}
.term .win-title {
  margin-left: 8px;
  font-size: 12px;
  color: var(--faint);
}
.term .win-body {
  margin: 0;
  padding: 18px 20px 20px;
  font-size: 13px;
  line-height: 1.75;
  color: #c6cdda;
  white-space: pre;
  overflow-x: auto;
}
.term .win-body .cmd {
  color: #fff;
}
.term .win-body .dim {
  color: var(--faint);
}
.term .win-body .add {
  color: var(--green-2);
}
.term .win-body .chg {
  color: var(--purple);
}
.term .win-body .old {
  color: #f0796b;
  text-decoration: line-through;
}
.term .win-body .new {
  color: var(--green-2);
}
.term .win-body .amb {
  color: var(--amber);
}
.term .win-body .you {
  color: #fff;
}
.term .win-body .ok {
  color: var(--green-2);
}

/* SECTIONS */
.term .sec {
  max-width: 1180px;
  margin: 0 auto;
  padding: clamp(56px, 9vw, 112px) clamp(16px, 4vw, 36px) 0;
}
.term .h2 {
  margin-top: 14px;
  font-size: clamp(24px, 3vw, 34px);
  color: #fff;
}
.term .body {
  margin-top: 18px;
  color: var(--dim);
  font-size: 16px;
  max-width: 50ch;
}
.term .body code {
  color: var(--amber);
}
.term .panel {
  background: linear-gradient(180deg, var(--panel), var(--bg-2));
  border: 1px solid var(--line);
  border-radius: 12px;
  transition:
    border-color 0.18s,
    transform 0.18s,
    box-shadow 0.18s;
}

/* STEPS */
.term .steps {
  margin-top: 28px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
}
.term .step {
  padding: 22px 22px 24px;
}
.term .step:hover {
  border-color: var(--line-2);
  transform: translateY(-3px);
  box-shadow: 0 24px 50px -30px rgba(0, 0, 0, 0.7);
}
.term .step-top {
  display: flex;
  align-items: center;
  gap: 12px;
}
.term .idx {
  font-size: 12px;
  color: var(--green);
  border: 1px solid var(--line-2);
  border-radius: 6px;
  padding: 3px 8px;
  letter-spacing: 0.05em;
}
.term .step-cmd {
  font-size: 15px;
  color: #fff;
}
.term .step p {
  margin-top: 15px;
  color: var(--dim);
  font-size: 14.5px;
}
.term .step code {
  font-size: 12.5px;
}

/* CONFIG */
.term .config-grid {
  display: grid;
  grid-template-columns: 0.85fr 1.15fr;
  gap: clamp(32px, 5vw, 60px);
  align-items: center;
}
.term .ticks {
  margin-top: 22px;
  list-style: none;
  padding: 0;
  display: grid;
  gap: 11px;
}
.term .ticks li {
  position: relative;
  padding-left: 26px;
  color: var(--dim);
  font-size: 14.5px;
}
.term .ticks li::before {
  content: '✓';
  position: absolute;
  left: 0;
  top: -1px;
  color: var(--green);
  font-weight: 700;
}
.term .editor {
  align-self: stretch;
}
.term .code {
  font-size: 12.8px;
  line-height: 1.72;
  font-variant-numeric: tabular-nums;
}
.term .code .k {
  color: var(--purple);
}
.term .code .s {
  color: #7ee787;
}
.term .code .n {
  color: var(--amber);
}
.term .code .f {
  color: #79c0ff;
}

/* CARDS */
.term .cards {
  margin-top: 28px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 18px;
}
.term .card {
  padding: 24px 22px;
}
.term .card:hover {
  border-color: var(--line-2);
  transform: translateY(-3px);
  box-shadow: 0 24px 50px -30px rgba(0, 0, 0, 0.7);
}
.term .ico {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  color: var(--green);
  background: rgba(63, 185, 80, 0.1);
  border: 1px solid rgba(63, 185, 80, 0.22);
}
.term .card h3 {
  margin-top: 18px;
  font-size: 17px;
  color: #fff;
  font-weight: 600;
}
.term .card p {
  margin-top: 10px;
  color: var(--dim);
  font-size: 14px;
}

/* AGENTS */
.term .agent {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: clamp(30px, 4vw, 56px);
  align-items: center;
  padding: clamp(28px, 4vw, 48px);
  background:
    radial-gradient(120% 140% at 100% 0%, rgba(99, 91, 255, 0.1), transparent 55%),
    linear-gradient(180deg, var(--panel-2), var(--bg-2));
}
.term .agent .body {
  max-width: 44ch;
}
.term .registry {
  margin-top: 16px;
  color: var(--faint);
  font-size: 13.5px;
}
.term .registry strong {
  color: var(--ink);
}
.term .registry code {
  color: #cdd4ff;
}
.term .registry a {
  color: var(--green);
}
.term .agent-actions {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.term .install {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 15px;
  font-weight: 600;
  padding: 15px 20px;
  border-radius: 10px;
  border: 1px solid transparent;
  transition:
    transform 0.14s,
    background 0.14s;
}
.term .install.cursor {
  background: var(--ink);
  color: #0a0c11;
}
.term .install.cursor svg {
  color: #635bff;
}
.term .install.cursor:hover {
  transform: translateY(-2px);
  background: #fff;
}
.term .cc {
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
  background: #0b0e15;
  cursor: pointer;
}
.term .cc-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--line);
  font-size: 12px;
  color: var(--dim);
}
.term .cc-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--purple);
  box-shadow: 0 0 8px var(--purple);
}
.term .cc-code {
  margin: 0;
  padding: 13px 15px;
  font-size: 12.3px;
  line-height: 1.75;
  color: #b9c0cf;
  white-space: pre;
  overflow-x: auto;
}
.term .cc-cmd {
  color: var(--green);
}

/* FOOTER */
.term .foot {
  margin-top: clamp(64px, 10vw, 120px);
  border-top: 1px solid var(--line);
}
.term .foot-in {
  max-width: 1180px;
  margin: 0 auto;
  padding: 34px clamp(16px, 4vw, 36px);
  display: flex;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
  align-items: flex-start;
}
.term .foot-l {
  max-width: 44ch;
}
.term .foot-l p {
  margin-top: 12px;
  color: var(--faint);
  font-size: 13px;
}
.term .foot-l p a {
  color: var(--dim);
  border-bottom: 1px solid var(--line-2);
}
.term .foot-l p a:hover {
  color: var(--ink);
}
.term .foot-r {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.term .foot-r a {
  color: var(--dim);
  font-size: 13px;
  padding: 6px 11px;
  border: 1px solid var(--line);
  border-radius: 7px;
  transition:
    color 0.16s,
    border-color 0.16s;
}
.term .foot-r a:hover {
  color: var(--ink);
  border-color: var(--line-2);
}

/* RESPONSIVE */
@media (max-width: 900px) {
  .term .hero-grid,
  .term .config-grid,
  .term .agent {
    grid-template-columns: 1fr;
  }
  .term .steps,
  .term .cards {
    grid-template-columns: repeat(2, 1fr);
  }
  .term .hero-term {
    order: 2;
  }
}
@media (max-width: 560px) {
  .term .cards {
    grid-template-columns: 1fr;
  }
}
@media (prefers-reduced-motion: reduce) {
  .term *,
  .term .caret {
    animation: none !important;
    transition: none !important;
  }
}
</style>
