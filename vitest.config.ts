import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.{test,spec}.ts'],
    exclude: [
      'node_modules',
      'dist',
      'bin',
      'scripts'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/utils/orahelper.ts',
        'src/types/file-upload.ts',
        'src/types/build-logs.ts'
      ],
      // Separate thresholds for different test types
      thresholds: {
        // Ratcheted to the measured floor (BE-10005: 99.35 stmt / 98.51 branch / 99.22 fn / 99.36 line).
        // The remaining gap is unreachable or dead source code, not untested behaviour. Functions use 98:
        // at 99 the margin was only 2 functions.
        // Vitest does not treat "global" as a special key (it is read as a glob), so `yarn test` does not
        // enforce these numbers. CI enforces them with `node scripts/parse-coverage.js check-threshold`,
        // which reads this "global" block, so keep its shape.
        global: {
          branches: 98,
          functions: 98,
          lines: 99,
          statements: 99
        },
        // Unit tests should have higher coverage
        'tests/unit/**': {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85
        },
        // Integration tests focus on workflows
        'tests/integration/**': {
          branches: 60,
          functions: 60,
          lines: 60,
          statements: 60
        }
      }
    },
    testTimeout: 15000,
    hookTimeout: 10000,
    setupFiles: ['./tests/setup/test-setup.ts']
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@tests': resolve(__dirname, 'tests')
    }
  }
})