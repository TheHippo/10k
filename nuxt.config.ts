import tailwindcss from "@tailwindcss/vite";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  ssr: false,
  modules: ['@nuxt/icon', '@vite-pwa/nuxt'],
  vite: {
    plugins: [tailwindcss() as any],
  },
  css: ['~/assets/css/main.css'],

  pwa: {
    manifest: {
      name: '10,000',
      short_name: '10k',
      description: 'Score tracker for the dice game 10,000 (Farkle)',
      theme_color: '#1d232a',
      background_color: '#1d232a',
      display: 'standalone',
      orientation: 'portrait',
      scope: '/',
      start_url: '/',
      icons: [
        { src: 'icons/pwa-64x64.png', sizes: '64x64', type: 'image/png' },
        { src: 'icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icons/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        { src: 'icons/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
      skipWaiting: true,
      clientsClaim: true,
    },
    devOptions: {
      enabled: true,
      type: 'module',
    },
  },
})
