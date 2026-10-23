import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      // O service worker não deve interceptar as rotas de API (scraping/notify),
      // que precisam ir sempre à rede.
      workbox: {
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'VagaFounder — Monitor de Vagas',
        short_name: 'VagaFounder',
        description:
          'Monitor inteligente de vagas de emprego em tempo real nas principais plataformas do Brasil.',
        lang: 'pt-BR',
        theme_color: '#4f46e5',
        background_color: '#1e1f22',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // No dev puro do Vite, não ative o SW para não cachear durante o desenvolvimento.
      devOptions: {
        enabled: false,
      },
    }),
  ],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  envPrefix: ['VITE_', 'TAURI_'],
});
