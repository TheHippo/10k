<script setup lang="ts">
import { ref } from 'vue'
import { db } from '~/db'

useHead({ title: 'Players' })

const players = usePlayers()

const newPlayerModal = ref<{ open: () => void } | null>(null)
const confirmModal = ref<{ open: () => void, close: () => void } | null>(null)
const playerToDelete = ref<{ id: number, name: string } | null>(null)

function askRemove(player: { id: number, name: string }) {
  playerToDelete.value = player
  confirmModal.value?.open()
}

async function removePlayer() {
  if (!playerToDelete.value) return
  await db.players.update(playerToDelete.value.id, { deleted: true })
  confirmModal.value?.close()
  playerToDelete.value = null
}
</script>

<template>
  <PageHeader title="Players">
    <template #actions>
      <button class="btn btn-neutral btn-sm gap-2" @click="newPlayerModal?.open()">
        <Icon name="heroicons:user-plus" class="size-4" /> New Player
      </button>
    </template>
  </PageHeader>

  <EmptyState v-if="players.length === 0">No players yet.</EmptyState>

  <AppCard v-else>
    <ul class="list">
      <li v-for="p in players" :key="p.id" class="list-row items-center px-0 py-1">
        <span class="grow">{{ p.name }}</span>
        <button
          class="btn btn-ghost btn-sm btn-square text-error"
          :aria-label="`Remove ${p.name}`"
          @click="askRemove(p)"
        >
          <Icon name="heroicons:x-mark" class="size-4" />
        </button>
      </li>
    </ul>
  </AppCard>

  <NewPlayerModal ref="newPlayerModal" />

  <AppModal ref="confirmModal" title="Remove player?">
    <p>Remove <strong>{{ playerToDelete?.name }}</strong> from the player list?</p>
    <template #actions="{ close }">
      <button class="btn btn-ghost gap-2" @click="close">
        <Icon name="heroicons:x-mark" class="size-4" /> Cancel
      </button>
      <button class="btn btn-error gap-2" @click="removePlayer">
        <Icon name="heroicons:trash" class="size-4" /> Remove
      </button>
    </template>
  </AppModal>
</template>
