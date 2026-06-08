import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
// @ts-ignore — no types shipped with this plugin
import basicSsl from '@vitejs/plugin-basic-ssl';

// Required headers for SharedArrayBuffer
// WARNING: Enabling COEP (even 'credentialless') will block third-party iframes 
// like YouTube unless they are explicitly marked with the `credentialless` attribute.
// Since the YouTube IFrame API creates the iframe dynamically, it gets blocked.
// We disable these headers so YouTube works on localhost.
const coopCoepHeaders = {
  // 'Cross-Origin-Opener-Policy': 'same-origin',
  // 'Cross-Origin-Embedder-Policy': 'credentialless',
};

// Enable HTTPS locally so the Cast API (Chromecast / AirPlay) can init on mobile.
// Run:  VITE_HTTPS=1 npm run dev   (or set in .env.local)
const useHttps = Boolean(process.env.VITE_HTTPS);

export default defineConfig({
  plugins: [
    react(),
    ...(useHttps ? [basicSsl()] : []),
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
    host: true,
    port: 5173,
    strictPort: true,
    headers: coopCoepHeaders,
    // basicSsl() plugin (when VITE_HTTPS=1) auto-configures https \u2014 no manual flag needed
  },
  preview: {
    headers: coopCoepHeaders,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});