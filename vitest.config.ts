import { fileURLToPath } from 'node:url'
import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // test/dashboard-contract.spec.ts imports the dashboard's own client and converters, which use the dashboard's @/ alias
  resolve: { alias: { '@': fileURLToPath(new URL('./dashboard', import.meta.url)) } },
  // swc keeps the decorator metadata Nest dependency injection needs (esbuild does not emit it).
  plugins: [swc.vite({ module: { type: 'es6' }, jsc: { target: 'es2022', parser: { syntax: 'typescript', decorators: true }, transform: { legacyDecorator: true, decoratorMetadata: true } } })],
  test: {
    globals: true,
    include: ['test/**/*.spec.ts'],
    globalSetup: ['test/global-setup.ts'],
    setupFiles: ['test/setup.ts'],
    fileParallelism: false, // one shared test database and one Redis prefix
    testTimeout: 30000,
    hookTimeout: 60000,
  },
})
