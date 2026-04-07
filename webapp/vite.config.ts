import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  // Root .env lives one level up from webapp/ (both locally and in Docker).
  // Locally: __dirname = [repo]/webapp  →  ../ = [repo]/
  // Docker:  __dirname = /app/webapp    →  ../ = /app/  (where .env was copied)
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '')

  return {
    define: Object.fromEntries(
      Object.entries(env)
        .filter(([key]) => key.startsWith('VITE_'))
        .map(([key, val]) => [`import.meta.env.${key}`, JSON.stringify(val)])
    ),
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 3000,
      open: false,
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
  }
})
