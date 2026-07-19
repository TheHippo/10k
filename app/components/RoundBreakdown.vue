<script setup lang="ts">
import { computed } from 'vue'
import type { RoundBreakdown as RoundBreakdownEntry, GamePlayerWithName } from '~/interfaces'

const props = defineProps<{
  rounds: RoundBreakdownEntry[]
  players: GamePlayerWithName[]
}>()

const rows = computed(() => props.rounds.map(round => ({
  round: round.round,
  cells: props.players.map(player => ({
    player,
    turn: round.turns.find(t => t.gamePlayerId === player.id),
  })),
})))
</script>

<template>
  <p v-if="rows.length === 0" class="text-sm text-base-content/60">No rounds recorded yet.</p>

  <div v-else class="overflow-x-auto">
    <table class="table table-sm">
      <thead>
        <tr>
          <th>Round</th>
          <th v-for="player in players" :key="player.id" class="text-right">{{ player.playerName }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.round">
          <td class="text-base-content/60">{{ row.round }}</td>
          <td v-for="cell in row.cells" :key="cell.player.id" class="text-right font-mono">
            <template v-if="cell.turn">
              <span :class="cell.turn.farkled ? 'text-error' : ''">
                <template v-if="cell.turn.farkled">
                  FARKLE<template v-if="cell.turn.penalty !== 0"> ({{ cell.turn.penalty }})</template>
                </template>
                <template v-else>+{{ cell.turn.pointsBanked }}</template>
              </span>
              <span class="block text-xs text-base-content/50">{{ cell.turn.runningTotal }}</span>
            </template>
            <span v-else class="text-base-content/30">—</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
