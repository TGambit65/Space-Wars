import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? '/play/' : '/',
  server: {
    host: '0.0.0.0',
    port: 3080,
    fs: {
      allow: ['..']
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5080',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://localhost:5080',
        ws: true,
        changeOrigin: true
      }
    }
  }
})

