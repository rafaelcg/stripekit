import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { StripekitError } from '../util/errors'
import type { AuthLibrary, ProjectInfo, SyncAdapter } from './detect'

export interface ScaffoldOptions {
  adapter: SyncAdapter
  auth: AuthLibrary
  webhookPath: string
}

export interface ScaffoldResult {
  written: string[]
  skipped: string[]
}

interface FileMapping {
  templateRel: string
  destRel: string
}

/** Locate the shipped templates directory, whether running from dist or src. */
function templatesRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url))
  const candidates = [
    resolve(here, '../templates/init'), // dist/cli.js -> <pkg>/templates
    resolve(here, '../../templates/init'), // src/init/scaffold.ts -> <pkg>/templates
    resolve(here, '../../../templates/init'),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  throw new StripekitError('Could not locate stripekit templates directory.')
}

function fileMappings(project: ProjectInfo, opts: ScaffoldOptions): FileMapping[] {
  const lib = (name: string) => `${project.srcPrefix}lib/stripe/${name}`
  const app = (path: string) => `${project.srcPrefix}app/${path}`
  const webhookDir = opts.webhookPath.replace(/^\/+/, '').replace(/\/+$/, '')

  const files: FileMapping[] = [
    { templateRel: 'lib/stripe/state.ts', destRel: lib('state.ts') },
    { templateRel: 'lib/stripe/client.ts', destRel: lib('client.ts') },
    { templateRel: 'lib/stripe/sync.ts', destRel: lib('sync.ts') },
    { templateRel: 'lib/stripe/customer.ts', destRel: lib('customer.ts') },
    { templateRel: `lib/stripe/store.${opts.adapter}.ts`, destRel: lib('store.ts') },
    { templateRel: `lib/stripe/auth.${opts.auth}.ts`, destRel: lib('auth.ts') },
    { templateRel: 'app/api/stripe/webhook/route.ts', destRel: app(`${webhookDir}/route.ts`) },
    {
      templateRel: 'app/api/stripe/checkout/route.ts',
      destRel: app('api/stripe/checkout/route.ts'),
    },
    { templateRel: 'app/api/stripe/portal/route.ts', destRel: app('api/stripe/portal/route.ts') },
  ]

  if (opts.adapter === 'drizzle') {
    files.push({ templateRel: 'lib/stripe/schema.ts', destRel: lib('schema.ts') })
    files.push({ templateRel: 'lib/stripe/db.ts', destRel: lib('db.ts') })
  }

  return files
}

/** The list of destination files init would create (for previews). */
export function plannedFiles(project: ProjectInfo, opts: ScaffoldOptions): string[] {
  return fileMappings(project, opts).map((f) => f.destRel)
}

/**
 * Write the generated billing code into the project. Existing files are left
 * untouched (reported as skipped) unless `force` is set.
 */
export function writeScaffold(
  project: ProjectInfo,
  opts: ScaffoldOptions,
  { force = false }: { force?: boolean } = {},
): ScaffoldResult {
  const root = templatesRoot()
  const result: ScaffoldResult = { written: [], skipped: [] }

  for (const file of fileMappings(project, opts)) {
    const dest = resolve(project.cwd, file.destRel)
    if (existsSync(dest) && !force) {
      result.skipped.push(file.destRel)
      continue
    }
    let contents = readFileSync(resolve(root, file.templateRel), 'utf8')
    if (project.importAlias !== '@/') {
      contents = contents.split('@/').join(project.importAlias)
    }
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, contents, 'utf8')
    result.written.push(file.destRel)
  }

  return result
}

/** Write the starter stripe.config.ts (returns null if one already exists). */
export function writeStarterConfig(project: ProjectInfo, { force = false } = {}): string | null {
  const dest = resolve(project.cwd, 'stripe.config.ts')
  if (existsSync(dest) && !force) return null
  const contents = readFileSync(resolve(templatesRoot(), 'stripe.config.ts'), 'utf8')
  writeFileSync(dest, contents, 'utf8')
  return 'stripe.config.ts'
}

/** npm packages the generated code needs, based on the chosen adapter. */
export function requiredPackages(opts: ScaffoldOptions): string[] {
  const packages = ['stripe', 'server-only']
  if (opts.adapter === 'kv') packages.push('@upstash/redis')
  if (opts.adapter === 'drizzle') packages.push('drizzle-orm', 'postgres')
  return packages
}

/** Env vars the generated code reads, grouped for the setup summary. */
export function requiredEnv(opts: ScaffoldOptions): string[] {
  const env = ['STRIPE_SECRET_KEY', 'NEXT_PUBLIC_APP_URL']
  if (opts.adapter === 'kv') env.push('UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN')
  if (opts.adapter === 'drizzle') env.push('DATABASE_URL')
  return env
}
