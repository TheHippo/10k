<script setup lang="ts">
const pwa = usePWA()

function reload() {
  pwa?.updateServiceWorker(true)
}

// Returning to the tab is the moment a user is most likely to accept an update.
useVisibilityChange(() => pwa?.getSWRegistration()?.update())
</script>

<template>
  <AppToast v-if="pwa?.needRefresh" icon="heroicons:arrow-path">
    A new version is available.
    <template #actions>
      <button class="btn btn-primary btn-sm" @click="reload">Reload</button>
    </template>
  </AppToast>
</template>
