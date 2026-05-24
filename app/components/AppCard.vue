<script setup lang="ts">
withDefaults(defineProps<{
  shadow?: string
  compact?: boolean
}>(), {
  shadow: 'shadow',
  compact: false,
})
</script>

<template>
  <div :class="['card bg-base-200', shadow]">
    <div :class="['card-body', { 'py-4': compact }]">
      <slot />
    </div>
  </div>
</template>
