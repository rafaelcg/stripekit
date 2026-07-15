import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import HomeCompare from './HomeCompare.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout() {
    // Render the "hard way vs. stripekit" comparison right after the hero,
    // above the feature grid.
    return h(DefaultTheme.Layout, null, {
      'home-hero-after': () => h(HomeCompare),
    })
  },
  enhanceApp() {
    if (typeof window !== 'undefined') registerWebMcp()
  },
}

/**
 * WebMCP: expose read-only docs tools to in-browser AI agents. Experimental
 * (navigator.modelContext) — feature-detected and wrapped, so it no-ops where
 * unsupported and never affects the page.
 */
function registerWebMcp(): void {
  const nav = navigator as unknown as {
    modelContext?: { provideContext?: (ctx: unknown) => void }
  }
  if (typeof nav.modelContext?.provideContext !== 'function') return

  const text = (t: string) => ({ content: [{ type: 'text', text: t }] })
  try {
    nav.modelContext.provideContext({
      tools: [
        {
          name: 'stripekit_docs_index',
          description:
            "Get the URLs of stripekit's machine-readable docs (llms.txt index and llms-full.txt bundle).",
          inputSchema: { type: 'object', properties: {} },
          execute: async () =>
            text(
              'llms.txt: https://stripe.rafael.ltd/llms.txt\nllms-full.txt: https://stripe.rafael.ltd/llms-full.txt\nskill: https://stripe.rafael.ltd/SKILL.md',
            ),
        },
        {
          name: 'stripekit_list_commands',
          description: 'List the stripekit CLI commands and what each does.',
          inputSchema: { type: 'object', properties: {} },
          execute: async () =>
            text(
              [
                'init  — scaffold config + billing code (Next.js) or catalog-only (any stack)',
                'plan  — preview reconciliation (read-only)',
                'push  — reconcile your Stripe account to stripe.config.ts',
                'pull  — generate stripe.config.ts from an existing account',
                'dev   — forward webhooks locally (wraps `stripe listen`)',
                'check — verify keys, config, drift, and webhook/portal wiring',
              ].join('\n'),
            ),
        },
      ],
    })
  } catch {
    // WebMCP is experimental; ignore any provisioning failure.
  }
}
