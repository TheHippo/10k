<script setup lang="ts">
import { ref } from 'vue'

withDefaults(defineProps<{
  title: string
  /** Label for the always-present dismiss button. */
  cancelLabel?: string
}>(), { cancelLabel: 'Cancel' })

defineEmits<{ close: [] }>()

const dialogRef = ref<HTMLDialogElement | null>(null)

function open() {
  dialogRef.value?.showModal()
}

function close() {
  dialogRef.value?.close()
}

defineExpose({ open, close })
</script>

<template>
  <dialog ref="dialogRef" class="modal" @close="$emit('close')">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-4">{{ title }}</h3>
      <slot />
      <div class="modal-action">
        <!-- Owned by the modal so every dialog dismisses the same way and looks the same. -->
        <button class="btn btn-ghost gap-2" @click="close">
          <Icon name="heroicons:x-mark" /> {{ cancelLabel }}
        </button>
        <slot name="actions" :close="close" />
      </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button>close</button></form>
  </dialog>
</template>
