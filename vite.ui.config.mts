// Só a interface no navegador, com dados de exemplo (src/renderer/src/dev/mock.ts).
// Útil para mexer no visual sem abrir o Electron: npm run dev:ui
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: resolve(import.meta.dirname, 'src/renderer'),
  plugins: [react()],
  define: { __VUE_OPTIONS_API__: false, __VUE_PROD_DEVTOOLS__: false, __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false },
  server: { port: 5173, strictPort: true }
})
