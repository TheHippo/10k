<script setup lang="ts">
import { ref } from 'vue'
import { db } from '~/db'

const players = useLiveQuery(
  () => db.players.orderBy('name').filter(p => !p.deleted).toArray(),
  []
)

const newPlayerModal = ref<{ open: () => void } | null>(null)

async function removePlayer(id: number) {
  await db.players.update(id, { deleted: true })
}
</script>

<template>
  <div class="flex justify-between items-center mb-4">
    <h1 class="mb-0">Players</h1>
    <button class="btn btn-primary btn-sm" @click="newPlayerModal?.open()">+ New Player</button>
  </div>

  <p v-if="players.length === 0" class="text-base-content/60 text-center mt-8">
    No players yet.
  </p>
  <AppCard v-else>
    <ul class="space-y-2">
      <li v-for="p in players" :key="p.id" class="flex justify-between items-center">
        <span>{{ p.name }}</span>
        <button class="btn btn-ghost btn-sm btn-square text-error" @click="removePlayer(p.id)">✕</button>
      </li>
    </ul>
  </AppCard>

  <NewPlayerModal ref="newPlayerModal" />
</template>
