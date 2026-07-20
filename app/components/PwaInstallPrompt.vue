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
  <AppToast v-if="pwa?.showInstallPrompt" icon="heroicons:arrow-down-tray">
    Install this app for a better experience.
    <template #actions>
      <button class="btn btn-ghost btn-sm" @click="dismiss">Dismiss</button>
      <button class="btn btn-primary btn-sm" @click="install">Install</button>
    </template>
  </AppToast>
</template>
