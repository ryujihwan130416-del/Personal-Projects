import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { uiIds } from './ui-ids.plugin.ts'

export default defineConfig({
  plugins: [uiIds(), react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
})
