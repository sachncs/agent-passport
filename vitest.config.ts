import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Only pure unit tests by default. Integration tests (live testnet),
    // e2e tests (also live), and the k6-benchmark suite are excluded —
    // run them explicitly with `npm run test:integration` or `npm run benchmark`.
    include: ['src/**/*.test.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/*-integration.test.ts',
      'src/__tests__/e2e/**',
      'src/__tests__/benchmark.test.ts',
      'src/__tests__/graph-audit.test.ts',
    ],
    testTimeout: 30000,
    hookTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/__tests__/**', 'src/lib/__tests__/**', 'src/index.ts'],
      // Thresholds are an enforced floor for the deterministic unit suite.
      // Network-dependent paths are covered by integration tests separately;
      // keep this floor measured against the complete source tree so adding a
      // module cannot silently remove coverage from the release gate.
      thresholds: {
        statements: 90,
        branches: 80,
        functions: 92,
        lines: 90,
      },
    },
  },
});
