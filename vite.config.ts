import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['mycar-logo.svg'],
      manifest: {
        name: 'My Car',
        short_name: 'My Car',
        description: 'منصة تربط ملاك السيارات وموردي الأساطيل بالشركات الباحثة عن تأجير طويل الأجل في مصر',
        lang: 'ar',
        dir: 'rtl',
        theme_color: '#142D4E',
        background_color: '#F4F7FB',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/mycar-logo.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
})
