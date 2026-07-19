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
  /** In turn order, so breakdown columns read left-to-right as the turns were played. */
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
    const { gamePlayers, players, turns } = await loadGameDetail(game.id)
    const winner = players.find(p => p.id === game.winnerGamePlayerId)
    const { rounds } = deriveGameState(gamePlayers, turns)
    return {
      game,
      players: [...players].sort((a, b) => b.totalScore - a.totalScore),
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
  <PageHeader title="Past Games">
    <template #actions>
      <label class="flex items-center gap-2 text-sm cursor-pointer">
        <Icon name="heroicons:funnel" />
        <span>Hide aborted</span>
        <input type="checkbox" v-model="hideAborted" class="toggle toggle-sm" />
      </label>
    </template>
  </PageHeader>

  <EmptyState v-if="displayedGames.length === 0">No games finished yet.</EmptyState>

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

      <ul class="list">
        <li
          v-for="p in summary.players" :key="p.id"
          class="list-row items-center px-0 py-1 text-sm"
          :class="p.id === summary.game.winnerGamePlayerId && summary.winnerScore >= WIN_TARGET
            ? 'font-bold text-accent' : 'text-base-content/60'"
        >
          <span class="list-col-grow">{{ p.playerName }}</span>
          <span class="font-mono">{{ formatScore(p.totalScore) }}</span>
        </li>
      </ul>

      <RoundBreakdownPanel :rounds="summary.rounds" :players="summary.playersInTurnOrder" />
    </AppCard>
  </div>
</template>
