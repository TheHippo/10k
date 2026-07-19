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

  // Was repeated as class="size-4" on 29 of the 30 icon usages. 1rem === size-4.
  // shrink-0 keeps icons from being squeezed by long text in flex rows (alerts, toasts).
  icon: {
    size: '1rem',
    class: 'shrink-0',
  },

  pwa: {
    client: {
      periodicSyncForUpdates: 60 * 60,
      installPrompt: true,
    },
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
    registerType: 'prompt',
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
      clientsClaim: true,
    },
    devOptions: {
      enabled: true,
      type: 'module',
    },
  },
})
