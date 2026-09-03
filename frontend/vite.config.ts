import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev proxy sends /api and /ws to the real backend on :4000 so the SPA talks to
// the live orchestrator/compliance/settlement — no mocks.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // REST + the /api/v1/ws websocket both go to the real backend.
      '/api': { target: 'http://localhost:4000', changeOrigin: true, ws: true },
    },
  },
});
