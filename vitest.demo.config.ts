import { defineConfig } from 'vitest/config'
import baseConfig from './vite.config'

// Demo tests are opt-in and preserve their original environment and mock setup.
export default defineConfig({
  ...baseConfig,
  test: {
    testTimeout: 30_000,
    projects: [
      {
        extends: true,
        test: {
          name: 'demo-display',
          environment: 'node',
          include: ['tests/display/demo/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'demo-app',
          environment: 'jsdom',
          include: ['demo-app/tests/**/*.test.ts'],
          setupFiles: ['./tests/support/setup.ts'],
          css: true,
        },
      },
    ],
  },
})
