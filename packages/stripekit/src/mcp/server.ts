import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { VERSION } from '../constants'
import { mcpCheck, mcpPlan, mcpPull, mcpPush } from './handlers'

interface ToolResult {
  [key: string]: unknown
  content: { type: 'text'; text: string }[]
  isError?: boolean
}

function ok(data: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

function fail(error: unknown): ToolResult {
  return {
    content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
    isError: true,
  }
}

async function run<T>(fn: () => Promise<T>): Promise<ToolResult> {
  try {
    return ok(await fn())
  } catch (error) {
    return fail(error)
  }
}

/** Build the stripekit MCP server with its four tools. */
export function createMcpServer(): McpServer {
  const server = new McpServer({ name: 'stripekit', version: VERSION })

  const cwd = z
    .string()
    .optional()
    .describe(
      'Project directory containing stripe.config.ts (defaults to the server working directory).',
    )
  const url = z.string().optional().describe('Base URL used when resolving the webhook endpoint.')

  server.registerTool(
    'stripekit_plan',
    {
      title: 'stripekit plan',
      description:
        'Preview the changes that reconciling the Stripe account to stripe.config.ts would make (create/update/replace/archive products, prices, webhook, portal). Read-only — mutates nothing.',
      inputSchema: { cwd, url },
      annotations: { title: 'stripekit plan', readOnlyHint: true, openWorldHint: true },
    },
    ({ cwd, url }) => run(() => mcpPlan(cwd ?? process.cwd(), url)),
  )

  server.registerTool(
    'stripekit_check',
    {
      title: 'stripekit check',
      description:
        'Verify the Stripe key, config validity, config-vs-account drift, and webhook/portal wiring. Read-only.',
      inputSchema: { cwd, url },
      annotations: { title: 'stripekit check', readOnlyHint: true, openWorldHint: true },
    },
    ({ cwd, url }) => run(() => mcpCheck(cwd ?? process.cwd(), url)),
  )

  server.registerTool(
    'stripekit_pull',
    {
      title: 'stripekit pull',
      description:
        'Generate stripe.config.ts source from the existing Stripe catalog, to adopt an account. Read-only.',
      inputSchema: { cwd },
      annotations: { title: 'stripekit pull', readOnlyHint: true, openWorldHint: true },
    },
    ({ cwd }) => run(() => mcpPull(cwd ?? process.cwd())),
  )

  server.registerTool(
    'stripekit_push',
    {
      title: 'stripekit push',
      description:
        'Reconcile the Stripe account to stripe.config.ts. DRY-RUN by default (returns the plan and changes nothing). Set apply:true to actually create/update products, prices, the webhook, and the portal. A live-mode key additionally requires live:true. Prices are replaced (not mutated) and removed items are archived (not deleted); existing subscriptions are never disrupted.',
      inputSchema: {
        cwd,
        url,
        apply: z
          .boolean()
          .optional()
          .describe('Actually apply the changes. Default false (dry run).'),
        live: z
          .boolean()
          .optional()
          .describe('Required together with apply:true to modify a LIVE-mode Stripe account.'),
      },
      annotations: {
        title: 'stripekit push',
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
      },
    },
    ({ cwd, url, apply, live }) => run(() => mcpPush(cwd ?? process.cwd(), { url, apply, live })),
  )

  return server
}

/** Start the server on stdio. stdout carries the protocol; logs must go to stderr. */
export async function startMcpServer(): Promise<void> {
  const server = createMcpServer()
  await server.connect(new StdioServerTransport())
}
