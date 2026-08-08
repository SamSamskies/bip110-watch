import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/proxy/orange': {
        target: 'https://bip110.orange.surf',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/orange/, '/api'),
      },
      '/proxy/fork': {
        target: 'https://fork.observer',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/fork/, '/api'),
      },
    },
  },
  test: {
    environment: 'node',
  },
})
