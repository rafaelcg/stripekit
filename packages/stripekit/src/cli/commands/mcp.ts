import { startMcpServer } from '../../mcp/server'

/**
 * Run stripekit as an MCP server over stdio. stdout is the protocol channel, so
 * nothing but MCP messages may be written there — status goes to stderr.
 */
export async function runMcp(): Promise<void> {
  process.stderr.write('stripekit MCP server running on stdio.\n')
  await startMcpServer()
}
