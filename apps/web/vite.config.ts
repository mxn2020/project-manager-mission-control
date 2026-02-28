import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@mission-control/types': resolve(__dirname, '../../packages/types/src/index.ts'),
      '@mission-control/api': resolve(__dirname, '../../packages/api/src/index.ts'),
      '@mission-control/hooks': resolve(__dirname, '../../packages/hooks/src/index.ts'),
    },
  },
})
