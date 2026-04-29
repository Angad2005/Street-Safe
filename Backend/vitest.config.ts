import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    alias: {
      '~/lib': path.resolve(__dirname, "./src/lib"),
      '~/services': path.resolve(__dirname, "./src/services")
    },
    exclude: ['**/node_modules/**', '**/dist/**', 'src/routing/**/*.test.ts']
  },
})