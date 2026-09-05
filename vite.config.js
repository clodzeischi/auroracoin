import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // The Firebase SDK is most of the bundle and changes only when the
        // dependency is upgraded, so it gets its own chunk: shipping a fix to
        // application code then re-downloads a few kB rather than ~680.
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
        },
      },
    },
  },
  test: {
    environment: 'happy-dom',
    env: { TZ: 'UTC' },
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.{test,spec}.{js,jsx}'],
  },
})
