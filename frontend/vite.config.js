import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // '^/api/' so the page /api-keys is not mistaken for an API call
      '^/api/': {
        target: 'http://localhost:5001',
        changeOrigin: true
      }
    }
  }
})
