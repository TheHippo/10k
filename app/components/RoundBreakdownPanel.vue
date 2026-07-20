<script setup lang="ts">
import type { GamePlayerWithName, RoundBreakdown as RoundBreakdownEntry } from '~/interfaces'

defineProps<{
  rounds: RoundBreakdownEntry[]
  /** In turn order, so columns read left-to-right as the turns were played. */
  players: GamePlayerWithName[]
}>()
</script>

<template>
  <div class="collapse collapse-arrow bg-base-100 mt-2">
    <input type="checkbox" aria-label="Toggle round breakdown" />
    <div class="collapse-title text-sm font-medium py-2 min-h-0">Round breakdown</div>
    <div class="collapse-content">
      <RoundBreakdown :rounds="rounds" :players="players" />
    </div>
  </div>
</template>
