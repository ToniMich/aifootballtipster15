import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy requests from /functions/v1 -> http://127.0.0.1:54321/functions/v1
      // This is crucial for local development to allow the Vite dev server
      // to communicate with the local Supabase Edge Functions server.
      '/functions/v1': {
        target: 'http://127.0.0.1:54321',
        changeOrigin: true,
      },
    },
  },
})
