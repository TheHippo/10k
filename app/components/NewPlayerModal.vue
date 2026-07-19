<script setup lang="ts">
import { ref } from 'vue'
import { db } from '~/db'
import type { Player } from '~/db'

const emit = defineEmits<{ created: [id: number] }>()

const modalRef = ref<{ open: () => void, close: () => void } | null>(null)
const newPlayerName = ref('')

function open() {
  newPlayerName.value = ''
  modalRef.value?.open()
}

async function createPlayer() {
  const name = newPlayerName.value.trim()
  if (!name) return
  const id = await db.players.add({ name } as Player)
  emit('created', id)
  modalRef.value?.close()
}

defineExpose({ open })
</script>

<template>
  <AppModal ref="modalRef" title="New Player">
    <input
      v-model="newPlayerName"
      type="text"
      placeholder="Player name"
      aria-label="Player name"
      class="input w-full"
      @keyup.enter="createPlayer"
    />
    <template #actions>
      <button class="btn btn-primary gap-2" :disabled="!newPlayerName.trim()" @click="createPlayer">
        <Icon name="heroicons:check" /> Create
      </button>
    </template>
  </AppModal>
</template>
