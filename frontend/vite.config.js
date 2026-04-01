import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:7001",
        changeOrigin: true,
      },
      "/cb": {
        target: "http://localhost:7001",
        changeOrigin: true,
      },
      "/logout": {
        target: "http://localhost:7001",
        changeOrigin: true,
      },
    },
  },
})
