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
        name: 'My Car عربيتي',
        short_name: 'My Car',
        description: 'منصة My Car عربيتي لخدمات السيارات والشركات والأساطيل في مصر',
        lang: 'ar',
        dir: 'rtl',
        theme_color: '#142D4E',
        background_color: '#142D4E',
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
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('/node_modules/')) return
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/scheduler/')
          ) return 'react-vendor'
          if (id.includes('/@supabase/')) return 'supabase-vendor'
          if (id.includes('/lucide-react/')) return 'icons-vendor'
        }
      }
    }
  }
})
