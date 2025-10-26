import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // This configuration is for the local Vite development server.
    // It explicitly sets the port to 5173 to match the setup instructions in README.md.
    port: 5173,
    
    // NOTE: This project uses Supabase Edge Functions for its backend, as detailed in the README.
    // There is no server proxy configuration needed here. The frontend communicates directly with
    // Supabase services using environment variables from the .env.local file.
  },
})
