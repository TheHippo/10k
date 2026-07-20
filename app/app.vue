<script setup lang="ts">
import { ref } from 'vue'

useHead({
  titleTemplate: (title) => title ? `10,000 - ${title}` : '10,000',
  link: [
    { rel: 'icon', href: '/icons/favicon.ico', sizes: 'any' },
    { rel: 'icon', href: '/icons/source.svg', type: 'image/svg+xml' },
    { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon-180x180.png' },
  ],
  // DaisyUI follows prefers-color-scheme, so the browser chrome has to as well —
  // a single dark theme-color framed a light page in dark chrome.
  // Values are DaisyUI 5's default base-100 for each scheme.
  meta: [
    { name: 'theme-color', media: '(prefers-color-scheme: light)', content: '#ffffff' },
    { name: 'theme-color', media: '(prefers-color-scheme: dark)', content: '#1d232a' },
  ],
})

const route = useRoute()
const drawerToggle = ref<HTMLInputElement | null>(null)

function closeDrawer() {
  if (drawerToggle.value) drawerToggle.value.checked = false
}
</script>

<template>
  <NuxtPwaManifest />
  <PwaUpdatePrompt />
  <PwaInstallPrompt />
  <div class="drawer lg:drawer-open">
    <input ref="drawerToggle" id="nav-drawer" type="checkbox" class="drawer-toggle" />

    <div class="drawer-content flex flex-col">
      <!-- Navbar -->
      <nav class="navbar bg-base-100 shadow-sm sticky top-0 z-10">
        <div class="flex-none lg:hidden">
          <label for="nav-drawer" aria-label="open sidebar" class="btn btn-ghost btn-square">
            <Icon name="heroicons:bars-3" class="size-6" />
          </label>
        </div>
        <div class="flex-1 px-2">
          <NuxtLink to="/" class="btn btn-ghost text-xl">10,000</NuxtLink>
        </div>
      </nav>

      <!-- Page content -->
      <main class="max-w-2xl mx-auto py-8 w-full px-4">
        <NuxtPage />
      </main>
    </div>

    <!-- Sidebar -->
    <div class="drawer-side z-20">
      <label for="nav-drawer" aria-label="close sidebar" class="drawer-overlay"></label>
      <ul class="menu bg-base-200 min-h-full w-64 p-4">
        <li>
          <NuxtLink to="/" :class="{ 'menu-active': route.path === '/' }" @click="closeDrawer">
            <Icon name="heroicons:play" /> Game
          </NuxtLink>
        </li>
        <li>
          <NuxtLink to="/history" :class="{ 'menu-active': route.path === '/history' }" @click="closeDrawer">
            <Icon name="heroicons:clock" /> History
          </NuxtLink>
        </li>
        <li>
          <NuxtLink to="/players" :class="{ 'menu-active': route.path === '/players' }" @click="closeDrawer">
            <Icon name="heroicons:users" /> Players
          </NuxtLink>
        </li>
      </ul>
    </div>
  </div>
</template>
