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
    ],
    testTimeout: 30000,
    hookTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      // ponytail: thresholds track what unit tests actually exercise. The
      // Algorand on-chain fetch paths in trust-score/sybil/delegation/
      // trust-graph/reputation/operator-wallet are exercised by
      // integration tests against live testnet (run via `npm run
      // test:integration`) — they are excluded from unit-test coverage so
      // the threshold reflects pure logic, not live-network dependencies.
      thresholds: {
        statements: 50,
        branches: 45,
        functions: 55,
        lines: 50,
      },
    },
  },
});
