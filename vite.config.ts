import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['carhome-icon.svg'],
      manifest: {
        name: 'My Car',
        short_name: 'My Car',
        description: 'منصة السيارات للشركات والأساطيل في مصر',
        lang: 'ar',
        dir: 'rtl',
        theme_color: '#142D4E',
        background_color: '#F4F7FB',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/carhome-icon.svg?v=20261031-2',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
})