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
        name: 'Carhome',
        short_name: 'Carhome',
        description: 'منصة تأجير السيارات طويل الأجل للشركات في مصر',
        lang: 'ar',
        dir: 'rtl',
        theme_color: '#142D4E',
        background_color: '#F4F7FB',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/carhome-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
})