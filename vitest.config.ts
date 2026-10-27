import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 30_000,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reportOnFailure: true,
      include: ['public/**/*.ts', 'hub/**/*.ts', 'tools/**/*.ts'],
      exclude: ['**/*.d.ts'],
      reporter: ['text', 'html', 'json', 'json-summary'],
      thresholds: { perFile: true, lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
