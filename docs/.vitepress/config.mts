import { defineConfig } from 'vitepress'
import llmstxt from 'vitepress-plugin-llms'

// Origin (scheme+host, no path) and base path are kept separate so the llms.txt
// plugin — which prepends `base` itself — doesn't double it. Overridable via
// DOCS_ORIGIN / DOCS_BASE for alternate hosts.
const ORIGIN = process.env.DOCS_ORIGIN ?? 'https://stripe.rafael.ltd'
const BASE = process.env.DOCS_BASE ?? '/'
const SITE = ORIGIN + BASE // full public root, e.g. https://stripe.rafael.ltd/

export default defineConfig({
  title: 'stripekit',
  description:
    'The create-next-app of Stripe. Declare your catalog, reconcile your own Stripe account, own the code.',
  lang: 'en-US',
  cleanUrls: true,
  lastUpdated: true,
  base: BASE,

  sitemap: { hostname: SITE },

  // Generate llms.txt + llms-full.txt + per-page .md for AI agents.
  // Exclude public/ (SKILL.md there is a served static asset, not a doc page).
  vite: {
    plugins: [llmstxt({ domain: ORIGIN, ignoreFiles: ['public/**'] })],
  },

  head: [
    ['meta', { name: 'theme-color', content: '#635bff' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'stripekit — the create-next-app of Stripe' }],
    [
      'meta',
      {
        property: 'og:description',
        content: 'Declare your catalog. Reconcile your own Stripe account. Own the code.',
      },
    ],
    ['link', { rel: 'alternate', type: 'text/markdown', href: `${SITE}llms.txt` }],
  ],

  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started', activeMatch: '/guide/' },
      { text: 'CLI', link: '/cli/init', activeMatch: '/cli/' },
      { text: 'Config', link: '/config' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Getting started', link: '/guide/getting-started' },
            { text: 'How it works', link: '/guide/how-it-works' },
            { text: 'Generated code', link: '/guide/generated-code' },
          ],
        },
      ],
      '/cli/': [
        {
          text: 'Commands',
          items: [
            { text: 'init', link: '/cli/init' },
            { text: 'plan', link: '/cli/plan' },
            { text: 'push', link: '/cli/push' },
            { text: 'pull', link: '/cli/pull' },
            { text: 'dev', link: '/cli/dev' },
            { text: 'check', link: '/cli/check' },
            { text: 'mcp', link: '/cli/mcp' },
          ],
        },
      ],
      '/config': [
        {
          text: 'Reference',
          items: [{ text: 'stripe.config.ts', link: '/config' }],
        },
      ],
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/rafaelcg/stripekit' }],

    search: { provider: 'local' },

    editLink: {
      pattern: 'https://github.com/rafaelcg/stripekit/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'A dev tool, not a platform — your Stripe, your code.',
    },
  },
})
