import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
  },
  optimizeDeps: {
    // Force Vite to pre-bundle these CJS modules so they get a proper `default` export.
    // es6-promise-pool is a transitive dep of @excalidraw/excalidraw and is CommonJS-only.
    include: [
      'es6-promise-pool',
      'roughjs',
      'roughjs/bin/rough',
    ],
  },
})


