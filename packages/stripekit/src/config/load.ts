import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createJiti } from 'jiti'
import { StripekitError } from '../util/errors'
import { validateConfig } from './schema'
import type { StripekitConfig } from './types'

const CONFIG_FILENAMES = [
  'stripe.config.ts',
  'stripe.config.mts',
  'stripe.config.js',
  'stripe.config.mjs',
]

/** Locate the config file in `cwd`, returning its absolute path or `null`. */
export function findConfigPath(cwd: string = process.cwd()): string | null {
  for (const name of CONFIG_FILENAMES) {
    const p = resolve(cwd, name)
    if (existsSync(p)) return p
  }
  return null
}

/**
 * Load and validate `stripe.config.ts`. TypeScript configs are transpiled on
 * the fly via jiti, so no build step is needed.
 */
export async function loadConfig(
  cwd: string = process.cwd(),
): Promise<{ path: string; config: StripekitConfig }> {
  const path = findConfigPath(cwd)
  if (!path) {
    throw new StripekitError(`No ${CONFIG_FILENAMES[0]} found in ${cwd}.`, {
      hint: 'Run `stripekit init` to create one.',
    })
  }

  const jiti = createJiti(import.meta.url, { moduleCache: false })
  let mod: unknown
  try {
    mod = await jiti.import(path, { default: true })
  } catch (err) {
    throw new StripekitError(`Failed to load ${path}.`, { cause: err })
  }

  if (mod == null || typeof mod !== 'object') {
    throw new StripekitError(`${path} must \`export default defineConfig({ ... })\`.`)
  }

  return { path, config: validateConfig(mod) }
}
