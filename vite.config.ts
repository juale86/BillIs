import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// https://vite.dev/config/
export default defineConfig({
  // Versión visible en Ajustes. Subirla con `npm version minor|patch --no-git-tag-version`.
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __APP_COMMIT__: JSON.stringify(process.env.GITHUB_SHA?.slice(0, 7) ?? 'local'),
    __APP_FECHA__: JSON.stringify(new Date().toISOString()),
  },
  // GitHub Pages sirve la app en https://juale86.github.io/BillIs/
  base: '/BillIs/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: { globPatterns: ['**/*.{js,css,html,woff2,png,svg,ico}'] },
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'logo.svg'],
      manifest: {
        name: 'BillIs',
        short_name: 'BillIs',
        description: 'Gastos e ingresos en segundos',
        lang: 'es-AR',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0f766e',
        background_color: '#f6f7f6',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Nuevo gasto', short_name: 'Gasto', url: './?nuevo=gasto', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
          { name: 'Nuevo ingreso', short_name: 'Ingreso', url: './?nuevo=ingreso', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
        ],
      },
    }),
  ],
})
