<script setup lang="ts">
import { ref } from 'vue'

const route = useRoute()
const drawerToggle = ref<HTMLInputElement | null>(null)

function closeDrawer() {
  if (drawerToggle.value) drawerToggle.value.checked = false
}
</script>

<template>
  <div class="drawer lg:drawer-open">
    <input ref="drawerToggle" id="nav-drawer" type="checkbox" class="drawer-toggle" />

    <div class="drawer-content flex flex-col">
      <!-- Navbar -->
      <nav class="navbar bg-base-100 shadow-sm sticky top-0 z-10">
        <div class="flex-none lg:hidden">
          <label for="nav-drawer" aria-label="open sidebar" class="btn btn-square btn-ghost">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block h-6 w-6 stroke-current">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </label>
        </div>
        <div class="flex-1 px-2">
          <span class="text-xl font-bold">10,000</span>
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
            New Game
          </NuxtLink>
        </li>
        <li>
          <NuxtLink to="/history" :class="{ 'menu-active': route.path === '/history' }" @click="closeDrawer">
            History
          </NuxtLink>
        </li>
        <li>
          <NuxtLink to="/players" :class="{ 'menu-active': route.path === '/players' }" @click="closeDrawer">
            Players
          </NuxtLink>
        </li>
      </ul>
    </div>
  </div>
</template>
