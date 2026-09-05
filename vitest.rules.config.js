import { defineConfig } from 'vite';

/**
 * Rules tests are separate from the unit suite: they need a running Firestore
 * emulator, so they are slower and have a hard external dependency. `yarn test`
 * must stay fast and offline; `yarn test:rules` starts the emulator around
 * this config.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['rules-tests/**/*.test.js'],
    // One emulator, one shared project id: parallel files would clear each
    // other's seed data between tests.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
