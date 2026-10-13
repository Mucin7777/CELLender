import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // 相対パスで配信（GitHub Pages の /CELLender/ でもルート配信でも動く）
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 通知（push）を扱うため、自前の Service Worker にプリキャッシュ一覧を注入する
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // 新しい版は裏で準備し、利用者が「最新版に更新」を押したときに切り替える
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'favicon-16.png', 'favicon-32.png', 'apple-touch-icon.png'],
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,png,ico,svg,webmanifest}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      manifest: {
        id: './',
        name: 'cellender',
        short_name: 'cellender',
        description: '細胞培養・アッセイのスケジュール管理',
        lang: 'ja',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F7FAF8',
        theme_color: '#F7FAF8',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // 開発サーバーでは Service Worker を使わない（検証は build + preview）
      devOptions: { enabled: false },
    }),
  ],
})
