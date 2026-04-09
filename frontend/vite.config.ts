/// <reference types="vitest" />

import legacy from '@vitejs/plugin-legacy'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    proxy: {
      '/esp32': {
        target: process.env.VITE_ESP32_URL ?? 'http://advaithydro.local:8091',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/esp32/, ''),
      },
    },
    allowedHosts: true
  },
  plugins: [
    react(),
    legacy(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
      manifest: {
        name: 'Hydrotherapy System',
        short_name: 'HydroSys',
        theme_color: '#0a5c99',
        orientation: 'landscape',
        display: 'standalone'
      },
      devOptions: {
        enabled: true,
        type: 'module',
      }
    })
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  }
})
