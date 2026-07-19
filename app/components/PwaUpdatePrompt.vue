<script setup lang="ts">
const pwa = usePWA()

function reload() {
  pwa?.updateServiceWorker(true)
}

function checkForUpdate() {
  if (document.visibilityState === 'visible') {
    pwa?.getSWRegistration()?.update()
  }
}

onMounted(() => {
  document.addEventListener('visibilitychange', checkForUpdate)
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', checkForUpdate)
})
</script>

<template>
  <div v-if="pwa?.needRefresh" class="toast toast-bottom toast-center z-30">
    <div class="alert alert-info">
      <Icon name="heroicons:arrow-path" class="size-4" />
      <span>A new version is available.</span>
      <button class="btn btn-sm btn-primary" @click="reload">Reload</button>
    </div>
  </div>
</template>
