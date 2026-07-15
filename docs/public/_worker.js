// Cloudflare Pages advanced-mode worker. Adds agent-discovery features that
// static hosting can't: RFC 8288 Link headers on every response, and
// "Markdown for Agents" content negotiation (Accept: text/markdown -> the
// generated .md twin of a page). Falls through to static assets on anything
// unexpected, so a bug here can never take the site down.
export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const origin = url.origin
    const link = [
      `<${origin}/llms.txt>; rel="alternate"; type="text/markdown"`,
      `<${origin}/llms.txt>; rel="service-doc"`,
      `<${origin}/.well-known/agent-skills/index.json>; rel="describedby"`,
      `<${origin}/sitemap.xml>; rel="sitemap"`,
    ].join(', ')

    try {
      const wantsMarkdown = (request.headers.get('Accept') || '').includes('text/markdown')
      const looksLikeFile = /\.[a-z0-9]+$/i.test(url.pathname)

      // Serve the .md twin when an agent asks for markdown on a clean-URL page.
      if (wantsMarkdown && !looksLikeFile) {
        const base = url.pathname.replace(/\/+$/, '')
        const mdPath = base === '' ? '/index.md' : `${base}.md`
        const md = await env.ASSETS.fetch(new Request(new URL(mdPath, origin)))
        if (md.ok) {
          return withHeaders(md, link, 'text/markdown; charset=utf-8')
        }
      }

      const res = await env.ASSETS.fetch(request)
      const markdown = /\.md$|\/llms(-full)?\.txt$/.test(url.pathname)
      return withHeaders(res, link, markdown ? 'text/markdown; charset=utf-8' : null)
    } catch {
      return env.ASSETS.fetch(request)
    }
  },
}

function withHeaders(res, link, contentType) {
  const headers = new Headers(res.headers)
  headers.set('Link', link)
  headers.set('X-Robots-Tag', 'all')
  headers.set('Vary', 'Accept')
  if (contentType) headers.set('Content-Type', contentType)
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
}
