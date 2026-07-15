import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { findConfigPath } from '../config/load'

export type AuthLibrary = 'clerk' | 'authjs' | 'better-auth' | 'none'
export type SyncAdapter = 'kv' | 'drizzle'
export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun'

export interface ProjectInfo {
  cwd: string
  isNext: boolean
  /** '' when app/ is at the root, 'src/' when it lives under src/. */
  srcPrefix: '' | 'src/'
  /** TypeScript import alias base, e.g. '@/'. */
  importAlias: string
  auth: AuthLibrary
  packageManager: PackageManager
  hasConfig: boolean
}

function readJson(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
  } catch {
    return null
  }
}

function allDependencies(pkg: Record<string, unknown> | null): Record<string, string> {
  if (!pkg) return {}
  return {
    ...((pkg.dependencies as Record<string, string> | undefined) ?? {}),
    ...((pkg.devDependencies as Record<string, string> | undefined) ?? {}),
  }
}

export function detectProject(cwd: string = process.cwd()): ProjectInfo {
  const pkg = readJson(resolve(cwd, 'package.json'))
  const deps = allDependencies(pkg)

  const srcPrefix: '' | 'src/' = existsSync(resolve(cwd, 'src/app'))
    ? 'src/'
    : existsSync(resolve(cwd, 'app'))
      ? ''
      : existsSync(resolve(cwd, 'src'))
        ? 'src/'
        : ''

  return {
    cwd,
    isNext: 'next' in deps,
    srcPrefix,
    importAlias: detectImportAlias(cwd),
    auth: detectAuth(deps),
    packageManager: detectPackageManager(cwd),
    hasConfig: findConfigPath(cwd) !== null,
  }
}

function detectAuth(deps: Record<string, string>): AuthLibrary {
  if ('@clerk/nextjs' in deps) return 'clerk'
  if ('next-auth' in deps || '@auth/core' in deps) return 'authjs'
  if ('better-auth' in deps) return 'better-auth'
  return 'none'
}

function detectPackageManager(cwd: string): PackageManager {
  if (existsSync(resolve(cwd, 'pnpm-lock.yaml'))) return 'pnpm'
  if (existsSync(resolve(cwd, 'yarn.lock'))) return 'yarn'
  if (existsSync(resolve(cwd, 'bun.lockb')) || existsSync(resolve(cwd, 'bun.lock'))) return 'bun'
  return 'npm'
}

/** Read the "@/*"-style path alias from tsconfig, defaulting to '@/'. */
function detectImportAlias(cwd: string): string {
  for (const name of ['tsconfig.json', 'jsconfig.json']) {
    const raw = existsSync(resolve(cwd, name)) ? readFileSync(resolve(cwd, name), 'utf8') : null
    if (!raw) continue
    // Tolerant of JSONC: just scan for a "<prefix>/*" path key.
    const match = raw.match(/"([^"*]+)\/\*"\s*:/)
    if (match) return `${match[1]}/`
  }
  return '@/'
}

export function installCommand(pm: PackageManager, packages: string[]): string {
  const args = packages.join(' ')
  switch (pm) {
    case 'pnpm':
      return `pnpm add ${args}`
    case 'yarn':
      return `yarn add ${args}`
    case 'bun':
      return `bun add ${args}`
    default:
      return `npm install ${args}`
  }
}
