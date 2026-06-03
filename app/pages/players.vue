<script setup lang="ts">
import { ref } from 'vue'
import { db } from '~/db'

const players = useLiveQuery(
  () => db.players.orderBy('name').filter(p => !p.deleted).toArray(),
  []
)

const newPlayerModal = ref<{ open: () => void } | null>(null)
const confirmDialogRef = ref<HTMLDialogElement | null>(null)
const playerToDelete = ref<{ id: number; name: string } | null>(null)

function askRemove(player: { id: number; name: string }) {
  playerToDelete.value = player
  confirmDialogRef.value?.showModal()
}

async function removePlayer() {
  if (!playerToDelete.value) return
  await db.players.update(playerToDelete.value.id, { deleted: true })
  confirmDialogRef.value?.close()
  playerToDelete.value = null
}
</script>

<template>
  <div class="flex justify-between items-center mb-4">
    <h1 class="mb-0">Players</h1>
    <button class="btn btn-primary btn-sm" @click="newPlayerModal?.open()">New Player</button>
  </div>

  <p v-if="players.length === 0" class="text-base-content/60 text-center mt-8">
    No players yet.
  </p>
  <AppCard v-else>
    <ul class="space-y-2">
      <li v-for="p in players" :key="p.id" class="flex justify-between items-center">
        <span>{{ p.name }}</span>
        <button class="btn btn-ghost btn-sm btn-square text-error" @click="askRemove(p)">✕</button>
      </li>
    </ul>
  </AppCard>

  <NewPlayerModal ref="newPlayerModal" />

  <dialog ref="confirmDialogRef" class="modal">
    <div class="modal-box">
      <h3 class="font-bold text-lg">Remove player?</h3>
      <p class="py-4">Remove <strong>{{ playerToDelete?.name }}</strong> from the player list?</p>
      <div class="modal-action">
        <form method="dialog">
          <button class="btn">Cancel</button>
        </form>
        <button class="btn btn-error" @click="removePlayer">Remove</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button>close</button></form>
  </dialog>
</template>
