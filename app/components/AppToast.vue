<script setup lang="ts">
defineProps<{ icon: string }>()
</script>

<template>
  <div class="toast toast-bottom toast-center z-30">
    <div class="alert alert-info py-2">
      <Icon :name="icon" class="size-4 shrink-0" />
      <span><slot /></span>
      <slot name="actions" />
    </div>
  </div>
</template>
