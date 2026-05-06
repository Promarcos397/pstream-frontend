import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: false,

      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,ttf,otf}'],
        globIgnores: ['**/*.{m3u8,ts,mp4,webm}'],
        navigateFallbackDenylist: [/^\/api/],

        // INCREASES LIMIT TO 5MB to allow landing-bg.png to be cached
        maximumFileSizeToCacheInBytes: 5242880
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});