// Testa o app de verdade (Electron aberto), depois do `electron-vite build`: npm run test:app
import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { include: ['test/app/**/*.app.ts'], environment: 'node', testTimeout: 60_000, hookTimeout: 60_000 } })
