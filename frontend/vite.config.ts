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
        name: "Dasatva Hydrotherapy Management System - Colonima",
        short_name: "Dasatva",
        description: "*HydroColon Therapy*\nInstall this powerful App to take full control of your hydro colon therapy sessions — anytime, anywhere.\nStart sessions with one tap, monitor live temperature, pressure, and water levels in real time, view detailed session logs, and trigger instant emergency shutdown if needed. Built for safety, precision, and peace of mind — your personal wellness companion is ready to go straight from your home screen.\nAdd to your device now for the smoothest, most reliable therapy experience.",
        theme_color: '#0a5c99',
        orientation: 'landscape',
        display: 'standalone',
        scope: "/",
        start_url: "/",
        display_override: [
          "window-controls-overlay"
        ],
        icons: [
          {
            src: "/favicon-96x96.png",
            sizes: "96x96",
            type: "image/png"
          },
          {
            src: "/web-app-manifest-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable"
          },
          {
            src: "/web-app-manifest-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ],
        protocol_handlers: [
          {
            protocol: "web+sessions",
            url: "/%s"
          }
        ],
        screenshots: [
          {
            src: "/screenshots/Dashboard-Hydro-Colon-Therapy-Desktop.png",
            sizes: "1240x953",
            type: "image/png",
            form_factor: "wide",
            label: "Desktop view"
          },
          {
            src: "/screenshots/Dashboard-Hydro-Colon-Therapy-Mobile.png",
            sizes: "390x844",
            type: "image/png",
            form_factor: "narrow",
            label: "Mobile view"
          }
        ]
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
