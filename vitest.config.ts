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
        'src/types/file-upload.ts'
      ],
      // Separate thresholds for different test types
      thresholds: {
        global: {
          branches: 75,
          functions: 70,
          lines: 75,
          statements: 75
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