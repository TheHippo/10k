<script setup lang="ts">
import { computed } from 'vue'
import { db } from '~/db'
import { deriveGameState } from '~/game/engine'
import { WIN_TARGET } from '~/constants/game'
import type { Game, GamePlayerWithName, RoundBreakdown } from '~/interfaces'

interface FinishedGameSummary {
  game: Game
  /** Sorted by score, for the standings list. */
  players: GamePlayerWithName[]
  /** Sorted by turn order, so breakdown columns read left-to-right as the turns were played. */
  playersInTurnOrder: GamePlayerWithName[]
  rounds: RoundBreakdown[]
  winnerName: string
  winnerScore: number
}

useHead({ title: 'Past Games' })

const finishedGames = useLiveQuery<FinishedGameSummary[]>(async () => {
  const games = await db.games.where('status').equals('finished').toArray()
  games.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
  return Promise.all(games.map(async (game) => {
    const gps = await db.gamePlayers.where('gameId').equals(game.id).sortBy('turnOrder')
    const turns = await db.turns.where('gameId').equals(game.id).sortBy('turnNumber')
    const players = await Promise.all(gps.map(async (gp) => {
      const player = await db.players.get(gp.playerId)
      return { ...gp, playerName: player?.name ?? 'Unknown' }
    }))
    const playersSorted = [...players].sort((a, b) => b.totalScore - a.totalScore)
    const winner = players.find(p => p.id === game.winnerGamePlayerId)
    const { rounds } = deriveGameState(gps, turns)
    return {
      game,
      players: playersSorted,
      playersInTurnOrder: players,
      rounds,
      winnerName: winner?.playerName ?? 'Unknown',
      winnerScore: winner?.totalScore ?? 0,
    }
  }))
}, [])

const hideAborted = useLocalStorage('history:hideAborted', false)
const displayedGames = computed(() =>
  hideAborted.value ? finishedGames.value.filter(s => s.winnerScore >= WIN_TARGET) : finishedGames.value
)
</script>

<template>
  <div class="flex justify-between items-center mb-4">
    <h1 class="mb-0">Past Games</h1>
    <label class="flex items-center gap-2 text-sm cursor-pointer">
      <Icon name="heroicons:funnel" class="size-4" />
      <span>Hide aborted</span>
      <input type="checkbox" v-model="hideAborted" class="toggle toggle-sm" />
    </label>
  </div>
  <p v-if="displayedGames.length === 0" class="text-base-content/60 text-center mt-8">No games finished yet.</p>
  <div class="space-y-4">
    <AppCard v-for="summary in displayedGames" :key="summary.game.id" shadow="shadow-sm" compact>
      <div class="flex justify-between items-center">
        <span class="text-sm text-base-content/60 font-medium">
          {{ summary.game.startedAt.toLocaleDateString() }}
        </span>
        <span v-if="summary.winnerScore >= WIN_TARGET" class="badge badge-accent">
          🏆 {{ summary.winnerName }}
        </span>
        <span v-else class="badge badge-neutral">Aborted</span>
      </div>
      <div class="divider my-1" />
      <div class="space-y-1">
        <div
          v-for="p in summary.players" :key="p.id"
          class="flex justify-between text-sm"
          :class="p.id === summary.game.winnerGamePlayerId && summary.winnerScore >= WIN_TARGET
            ? 'font-bold text-accent' : 'text-base-content/80'"
        >
          <span>{{ p.playerName }}</span>
          <span class="font-mono">{{ formatScore(p.totalScore) }}</span>
        </div>
      </div>
      <div class="collapse collapse-arrow bg-base-100 mt-2">
        <input type="checkbox" />
        <div class="collapse-title text-sm font-medium py-2 min-h-0">Round breakdown</div>
        <div class="collapse-content">
          <RoundBreakdown :rounds="summary.rounds" :players="summary.playersInTurnOrder" />
        </div>
      </div>
    </AppCard>
  </div>
</template>
