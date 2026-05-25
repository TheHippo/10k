<script setup lang="ts">
import { ref } from 'vue'
import { db } from '~/db'
import type { GamePlayer, Game } from '~/db'

const allPlayers = useLiveQuery(() => db.players.orderBy('name').filter(p => !p.deleted).toArray(), [])
const selectedPlayerIds = ref<(number | null)[]>([null, null])

const newPlayerModal = ref<{ open: () => void } | null>(null)

function addPlayer() {
  if (selectedPlayerIds.value.length < 6) selectedPlayerIds.value.push(null)
}

function removePlayer(i: number) {
  selectedPlayerIds.value.splice(i, 1)
}

async function startGame() {
  const ids = selectedPlayerIds.value.filter((id): id is number => id !== null)
  if (ids.length < 2) return

  await db.transaction('rw', db.games, db.gamePlayers, async () => {
    const gameId = await db.games.add({
      status: 'active',
      startedAt: new Date(),
      currentGamePlayerId: 0,
    } as Game)

    const firstId = await db.gamePlayers.add({
      gameId, playerId: ids[0], turnOrder: 0, totalScore: 0, consecutiveFarkles: 0,
    } as GamePlayer)

    for (let i = 1; i < ids.length; i++) {
      await db.gamePlayers.add({
        gameId, playerId: ids[i], turnOrder: i, totalScore: 0, consecutiveFarkles: 0,
      } as GamePlayer)
    }

    await db.games.update(gameId, { currentGamePlayerId: firstId })
  })

  selectedPlayerIds.value = [null, null]
}
</script>

<template>
  <AppCard>
    <h1>New Game</h1>

    <div class="space-y-2">
      <div v-for="(id, i) in selectedPlayerIds" :key="i" class="flex gap-2">
        <select v-model="selectedPlayerIds[i]" class="select select-bordered flex-1">
          <option :value="null" disabled>Select player…</option>
          <option v-for="p in allPlayers" :key="p.id" :value="p.id"
                  :disabled="selectedPlayerIds.some((sid, j) => sid === p.id && j !== i)">
            {{ p.name }}
          </option>
        </select>
        <button
          class="btn btn-ghost btn-square"
          :disabled="selectedPlayerIds.length <= 2"
          @click="removePlayer(i)"
        >✕</button>
      </div>
    </div>

    <div class="card-actions justify-between mt-4">
      <div class="flex gap-2">
        <button
          class="btn btn-ghost btn-sm"
          :disabled="selectedPlayerIds.length >= 6"
          @click="addPlayer"
        >+ Add Player</button>
        <button class="btn btn-ghost btn-sm" @click="newPlayerModal?.open()">+ New Player</button>
      </div>
      <button
        class="btn btn-primary"
        :disabled="selectedPlayerIds.some(id => id === null)"
        @click="startGame"
      >Start Game</button>
    </div>
  </AppCard>

  <NewPlayerModal ref="newPlayerModal" />
</template>
