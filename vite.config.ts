import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    sourcemap: true,
  },
  plugins: [
    react(),
    VitePWA({
      disable: process.env.NODE_ENV === 'development', // CRITICAL: Disable SW in dev to prevent loops
      // On Android/installed PWAs, `prompt` can leave users stuck on an old SW
      // until they manually refresh/accept the update. Prefer automatic updates.
      registerType: 'autoUpdate',
      // Ensure our messaging handlers are included in the generated SW,
      // so we only have ONE service worker at scope '/'
      workbox: {
        importScripts: ['firebase-messaging-sw.js'],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
      includeAssets: [
        'icons/pig-maskable.svg',
        'icons/pig-192.png',
        'icons/pig-512.png',
        'icons/apple-touch-icon.png'
      ],
      manifest: {
        name: 'GVNApp - Social Events Hub',
        short_name: 'GVNApp',
        description: 'Progressive Web App per organizzare eventi sociali e gestire spese di gruppo',
        theme_color: '#3B82F6',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icons/pig-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icons/pig-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icons/pig-maskable.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          },
          {
            src: 'icons/apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
            purpose: 'any'
          }
        ]
      }
    })
  ],
})
