import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** Parse a dotenv file into a plain object. Unquotes simple quoted values. */
export function readEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) return {}
  const out: Record<string, string> = {}
  for (const raw of readFileSync(filePath, 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key) out[key] = value
  }
  return out
}

/**
 * Resolve a variable from the environment, checking (highest precedence first)
 * `process.env`, then `.env.local`, then `.env` in `cwd`.
 */
export function resolveEnvVar(cwd: string, names: readonly string[]): string | undefined {
  const merged: Record<string, string> = {
    ...readEnvFile(resolve(cwd, '.env')),
    ...readEnvFile(resolve(cwd, '.env.local')),
    ...(process.env as Record<string, string>),
  }
  for (const name of names) {
    const value = merged[name]
    if (value) return value
  }
  return undefined
}

/** Pick the env file to write secrets into: prefer .env.local, else .env. */
export function chooseEnvFile(cwd: string): string {
  const local = resolve(cwd, '.env.local')
  const dot = resolve(cwd, '.env')
  if (existsSync(local)) return local
  if (existsSync(dot)) return dot
  return local
}

export interface EnvWriteResult {
  added: string[]
  updated: string[]
  unchanged: string[]
}

/**
 * Upsert `updates` into a dotenv file, preserving existing lines, comments, and
 * ordering. Existing keys are replaced in place; new keys are appended.
 */
export function upsertEnv(filePath: string, updates: Record<string, string>): EnvWriteResult {
  const existing = existsSync(filePath) ? readFileSync(filePath, 'utf8') : ''
  const lines = existing.length ? existing.split('\n') : []
  const result: EnvWriteResult = { added: [], updated: [], unchanged: [] }

  for (const [key, value] of Object.entries(updates)) {
    const nextLine = `${key}=${formatValue(value)}`
    const idx = lines.findIndex((line) => new RegExp(`^\\s*${escapeRegExp(key)}\\s*=`).test(line))
    if (idx >= 0) {
      if (lines[idx] === nextLine) result.unchanged.push(key)
      else {
        lines[idx] = nextLine
        result.updated.push(key)
      }
    } else {
      lines.push(nextLine)
      result.added.push(key)
    }
  }

  const output = `${lines.join('\n').replace(/\n+$/, '')}\n`
  writeFileSync(filePath, output, 'utf8')
  return result
}

function formatValue(value: string): string {
  return /[\s#'"]/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
