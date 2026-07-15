import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli/index.ts',
  },
  format: ['esm'],
  target: 'node20',
  dts: true,
  clean: true,
  sourcemap: true,
  // The `stripe` SDK is a runtime dependency, not bundled.
  external: ['stripe', 'jiti', 'zod', 'commander', '@clack/prompts', 'picocolors'],
})
