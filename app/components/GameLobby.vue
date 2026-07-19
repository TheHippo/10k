<script setup lang="ts">
import { ref } from 'vue'
import { db } from '~/db'
import type { GamePlayer, Game } from '~/db'
import { MIN_PLAYERS, MAX_PLAYERS } from '~/constants/game'

const allPlayers = useLiveQuery(() => db.players.orderBy('name').filter(p => !p.deleted).toArray(), [])
const selectedPlayerIds = ref<(number | null)[]>(Array(MIN_PLAYERS).fill(null))

const newPlayerModal = ref<{ open: () => void } | null>(null)

function addPlayer() {
  if (selectedPlayerIds.value.length < MAX_PLAYERS) selectedPlayerIds.value.push(null)
}

function removePlayer(i: number) {
  selectedPlayerIds.value.splice(i, 1)
}

async function startGame() {
  const ids = selectedPlayerIds.value.filter((id): id is number => id !== null)
  if (ids.length < MIN_PLAYERS) return

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

  selectedPlayerIds.value = Array(MIN_PLAYERS).fill(null)
}

function onPlayerCreated(id: number) {
  const emptyIndex = selectedPlayerIds.value.indexOf(null)
  if (emptyIndex !== -1) {
    selectedPlayerIds.value[emptyIndex] = id
  }
}
</script>

<template>
  <h1 class="mb-4">New Game</h1>
  <AppCard>
    <div class="space-y-2">
      <div v-for="(id, i) in selectedPlayerIds" :key="i" class="flex gap-2">
        <select v-model="selectedPlayerIds[i]" class="select flex-1">
          <option :value="null" disabled>Select player…</option>
          <option v-for="p in allPlayers" :key="p.id" :value="p.id"
                  :disabled="selectedPlayerIds.some((sid, j) => sid === p.id && j !== i)">
            {{ p.name }}
          </option>
        </select>
        <button
          class="btn btn-ghost btn-square"
          :aria-label="`Remove player slot ${i + 1}`"
          :disabled="selectedPlayerIds.length <= MIN_PLAYERS"
          @click="removePlayer(i)"
        ><Icon name="heroicons:x-mark" class="size-4" /></button>
      </div>
    </div>

    <div class="card-actions flex-col sm:flex-row sm:justify-between mt-4 gap-2">
      <div class="flex gap-2 w-full sm:w-auto">
        <button
          class="btn btn-neutral btn-sm gap-2 flex-1 sm:flex-none"
          :disabled="selectedPlayerIds.length >= MAX_PLAYERS"
          @click="addPlayer"
        ><Icon name="heroicons:user-plus" class="size-4" /> Add Player</button>
        <button class="btn btn-neutral btn-sm gap-2 flex-1 sm:flex-none" @click="newPlayerModal?.open()">
          <Icon name="heroicons:user-plus" class="size-4" /> New Player
        </button>
      </div>
      <button
        class="btn btn-primary btn-sm gap-2 w-full sm:w-auto"
        :disabled="selectedPlayerIds.some(id => id === null)"
        @click="startGame"
      ><Icon name="heroicons:play" class="size-4" /> Start Game</button>
    </div>
  </AppCard>

  <NewPlayerModal ref="newPlayerModal" @created="onPlayerCreated" />
</template>
