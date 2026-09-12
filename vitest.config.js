import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.js', 'tests/api/**/*.test.js'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    testTimeout: 15000,
  },
});
