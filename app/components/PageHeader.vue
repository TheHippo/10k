<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<template>
  <div class="flex justify-between items-center gap-2 mb-4">
    <h1 class="mb-0">{{ title }}</h1>
    <slot name="actions" />
  </div>
</template>
