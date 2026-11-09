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
        // Re-baselined for vitest 4+'s AST-based v8 counting (per-file coverage unchanged; the old
        // counting scored every line of the src/core/commands.ts data literal as a covered statement).
        global: {
          branches: 55,
          functions: 80,
          lines: 65,
          statements: 65
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