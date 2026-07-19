<script setup lang="ts">
const pwa = usePWA()

async function install() {
  await pwa?.install()
}

function dismiss() {
  pwa?.cancelInstall()
}
</script>

<template>
  <div v-if="pwa?.showInstallPrompt" class="toast toast-bottom toast-center z-30">
    <div class="alert alert-info">
      <Icon name="heroicons:arrow-down-tray" class="size-4" />
      <span>Install this app for a better experience.</span>
      <button class="btn btn-sm btn-ghost" @click="dismiss">Dismiss</button>
      <button class="btn btn-sm btn-primary" @click="install">Install</button>
    </div>
  </div>
</template>
