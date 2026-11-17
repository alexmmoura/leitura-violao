/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

// número da versão (package.json), mostrado em Configurações
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

// PWA / offline — especificação §12.7. Todos os recursos (JS, CSS, fontes musicais
// embutidas no bundle do VexFlow) são pré-armazenados; nada é buscado em CDN.
export default defineConfig({
  // caminhos relativos: o app funciona em qualquer pasta de qualquer hospedagem (celular)
  base: './',
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png', 'icon.ico'],
      manifest: {
        name: 'Claves',
        short_name: 'Claves',
        description: 'Treino local de leitura musical e domínio do braço do violão',
        lang: 'pt-BR',
        display: 'standalone',
        orientation: 'any',
        start_url: '.',
        theme_color: '#000000',
        background_color: '#000000',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
    }),
  ],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
