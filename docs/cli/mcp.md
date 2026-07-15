# stripekit mcp

Run stripekit as a [Model Context Protocol](https://modelcontextprotocol.io) server, so an AI agent (Claude Desktop, Cursor, Claude Code, …) can reconcile and inspect your Stripe account directly.

```bash
npx stripekit mcp
```

It's a **stdio** server — the right model for a dev tool: it runs locally, on demand, against your project. There's nothing to host.

## Tools

| Tool              | What it does                                          | Safety                                                                                                       |
| ----------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `stripekit_plan`  | Preview the changes `push` would make.                | Read-only                                                                                                    |
| `stripekit_check` | Verify key, config, drift, and webhook/portal wiring. | Read-only                                                                                                    |
| `stripekit_pull`  | Generate `stripe.config.ts` from the account.         | Read-only                                                                                                    |
| `stripekit_push`  | Reconcile the account to `stripe.config.ts`.          | **Dry-run by default.** `apply: true` to actually apply; `live: true` also required to touch a live account. |

Every tool returns structured JSON, and takes an optional `cwd` (the project directory containing `stripe.config.ts`).

## Configure your agent

Point your MCP client at the server and set `cwd` to your project (so it finds `stripe.config.ts` and reads `STRIPE_SECRET_KEY` from `.env.local`):

```json
{
  "mcpServers": {
    "stripekit": {
      "command": "npx",
      "args": ["-y", "stripekit@latest", "mcp"],
      "cwd": "/absolute/path/to/your/project"
    }
  }
}
```

- **Claude Desktop:** add this to `claude_desktop_config.json`.
- **Cursor:** add it to `.cursor/mcp.json`.
- **Claude Code:** `claude mcp add stripekit -- npx -y stripekit@latest mcp`.

If your key isn't in the project's `.env.local`, pass it through the client's `env` option instead.

## Safety

The write tool mirrors the CLI's guarantees: dry-run unless you ask to apply, a hard `live` gate for live-mode keys, prices replaced (not mutated), and removals archived (not deleted). Read-only tools can't change anything.
