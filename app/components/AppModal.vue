<script setup lang="ts">
import { ref } from 'vue'

defineProps<{ title: string }>()
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
        <slot name="actions" :close="close">
          <button class="btn btn-ghost gap-2" @click="close">
            <Icon name="heroicons:x-mark" class="size-4" /> Cancel
          </button>
        </slot>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button>close</button></form>
  </dialog>
</template>
