<script setup lang="ts">
import { ref } from 'vue'
import { db } from '~/db'
import type { Player } from '~/db'

const emit = defineEmits<{ created: [id: number] }>()

const dialogRef = ref<HTMLDialogElement | null>(null)
const newPlayerName = ref('')

function open() {
  newPlayerName.value = ''
  dialogRef.value?.showModal()
}

async function createPlayer() {
  const name = newPlayerName.value.trim()
  if (!name) return
  const id = await db.players.add({ name } as Player)
  emit('created', id)
  dialogRef.value?.close()
}

defineExpose({ open })
</script>

<template>
  <dialog ref="dialogRef" class="modal">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-4">New Player</h3>
      <input
        v-model="newPlayerName"
        type="text"
        placeholder="Player name"
        class="input input-bordered w-full"
        @keyup.enter="createPlayer"
      />
      <div class="modal-action">
        <button class="btn btn-ghost gap-2" @click="dialogRef?.close()">
          <Icon name="heroicons:x-mark" class="size-4" /> Cancel
        </button>
        <button class="btn btn-primary gap-2" :disabled="!newPlayerName.trim()" @click="createPlayer">
          <Icon name="heroicons:check" class="size-4" /> Create
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button>close</button></form>
  </dialog>
</template>
