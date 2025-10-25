import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Explicitly set the port to 5173 to match the README and avoid ambiguity.
    port: 5173,
    // The proxy is no longer needed because the Supabase Edge Functions
    // are configured with the correct CORS headers, allowing direct
    // requests from the browser during local development.
  },
})
