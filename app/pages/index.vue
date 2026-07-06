<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { db } from '~/db'
import { MIN_STASH_POINTS, THREE_PAIRS_POINTS, STRAIGHT_POINTS } from '~/constants/game'
import type { Game, GamePlayer, GamePlayerWithName, Turn } from '~/interfaces'

const activeGame = useLiveQuery<Game | undefined>(
  () => db.games.where('status').equals('active').first(),
  undefined,
)

const activeGamePlayers = useLiveQuery<GamePlayerWithName[]>(async () => {
  const game = await db.games.where('status').equals('active').first()
  if (!game) return []
  const gps = await db.gamePlayers.where('gameId').equals(game.id).sortBy('turnOrder')
  return Promise.all(gps.map(async (gp) => {
    const player = await db.players.get(gp.playerId)
    return { ...gp, playerName: player?.name ?? 'Unknown' }
  }))
}, [])

// --- Active game ---

const turnPoints = ref(0)
const stashedPoints = ref(0)
const isNotDivisibleBy50 = computed(() => turnPoints.value > 0 && turnPoints.value % 50 !== 0)

const pointsInputRef = ref<HTMLInputElement | null>(null)

async function refocusPointsInput() {
  await nextTick()
  pointsInputRef.value?.focus()
}

watch(activeGame, (game) => {
  if (game) refocusPointsInput()
})

function stashPoints() {
  if (turnPoints.value < MIN_STASH_POINTS) return
  stashedPoints.value += turnPoints.value
  turnPoints.value = 0
  refocusPointsInput()
}

function stashThreePairs() {
  stashedPoints.value += THREE_PAIRS_POINTS
  turnPoints.value = 0
  refocusPointsInput()
}

function stashStraight() {
  stashedPoints.value += STRAIGHT_POINTS
  turnPoints.value = 0
  refocusPointsInput()
}

async function bank() {
  if (!activeGame.value || turnPoints.value < MIN_STASH_POINTS) return
  const game = activeGame.value
  const gp = activeGamePlayers.value.find(p => p.id === game.currentGamePlayerId)
  if (!gp) return

  const total = stashedPoints.value + turnPoints.value
  const turnCount = await db.turns.where('gameId').equals(game.id).count()

  await db.transaction('rw', db.turns, db.gamePlayers, db.games, async () => {
    await db.turns.add({
      gameId: game.id, gamePlayerId: gp.id,
      turnNumber: turnCount + 1, pointsBanked: total,
      farkled: false, createdAt: new Date(),
    } as Turn)
    await db.gamePlayers.update(gp.id, {
      totalScore: gp.totalScore + total,
      consecutiveFarkles: 0,
    })
    await advanceTurn(game)
  })

  turnPoints.value = 0
  stashedPoints.value = 0
  refocusPointsInput()
}

async function farkle() {
  if (!activeGame.value) return
  const game = activeGame.value
  const gp = activeGamePlayers.value.find(p => p.id === game.currentGamePlayerId)
  if (!gp) return

  const turnCount = await db.turns.where('gameId').equals(game.id).count()
  const newFarkles = gp.consecutiveFarkles + 1
  const penalty = newFarkles >= 3 ? -1000 : 0

  await db.transaction('rw', db.turns, db.gamePlayers, db.games, async () => {
    await db.turns.add({
      gameId: game.id, gamePlayerId: gp.id,
      turnNumber: turnCount + 1, pointsBanked: 0,
      farkled: true, createdAt: new Date(),
    } as Turn)
    await db.gamePlayers.update(gp.id, {
      totalScore: gp.totalScore + penalty,
      consecutiveFarkles: newFarkles >= 3 ? 0 : newFarkles,
    })
    await advanceTurn(game)
  })

  stashedPoints.value = 0
  refocusPointsInput()
}

async function advanceTurn(game: Game) {
  const players = await db.gamePlayers.where('gameId').equals(game.id).sortBy('turnOrder')
  const idx = players.findIndex(p => p.id === game.currentGamePlayerId)
  const next = players[(idx + 1) % players.length]
  if (next) await db.games.update(game.id, { currentGamePlayerId: next.id })
}

async function endGame() {
  if (!activeGame.value) return
  const winner = [...activeGamePlayers.value].sort((a, b) => b.totalScore - a.totalScore)[0]
  await db.games.update(activeGame.value.id, {
    status: 'finished',
    finishedAt: new Date(),
    winnerGamePlayerId: winner?.id,
  })
}
</script>

<template>
  <!-- Active game -->
  <AppCard v-if="activeGame">
        <h1>Game in Progress</h1>

        <table class="table">
          <thead>
            <tr>
              <th>Player</th>
              <th class="text-right">Score</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="gp in activeGamePlayers" :key="gp.id"
                :class="gp.id === activeGame.currentGamePlayerId ? 'bg-base-300' : ''">
              <td>
                {{ gp.playerName }}
                <span v-if="gp.consecutiveFarkles > 0" class="badge badge-warning badge-sm ml-2">
                  {{ gp.consecutiveFarkles }} farkle{{ gp.consecutiveFarkles > 1 ? 's' : '' }}
                </span>
              </td>
              <td class="text-right font-mono font-bold">{{ gp.totalScore }}</td>
              <td>
                <span v-if="gp.id === activeGame.currentGamePlayerId" class="badge badge-primary">
                  current
                </span>
              </td>
            </tr>
          </tbody>
        </table>

        <div class="divider">Current Turn</div>

        <div v-if="stashedPoints > 0" class="alert alert-info py-2">
          <span>Stashed: <strong>{{ stashedPoints }} pts</strong> — roll all 6 again, need ≥ {{ MIN_STASH_POINTS }} this roll</span>
        </div>

        <div class="flex gap-2">
          <button class="btn btn-outline btn-sm flex-1 gap-2" @click="stashThreePairs">
            <Icon name="heroicons:squares-2x2" class="size-4" /> Three Pairs (+{{ THREE_PAIRS_POINTS }})
          </button>
          <button class="btn btn-outline btn-sm flex-1 gap-2" @click="stashStraight">
            <Icon name="heroicons:bars-4" class="size-4" /> Straight 1–6 (+{{ STRAIGHT_POINTS }})
          </button>
        </div>

        <input
          ref="pointsInputRef"
          v-model.number="turnPoints"
          type="number"
          min="0"
          step="50"
          placeholder="Points scored this roll"
          class="input input-bordered w-full"
        />
        <div v-if="isNotDivisibleBy50 && turnPoints >= MIN_STASH_POINTS" class="alert alert-warning py-2">
          <Icon name="heroicons:exclamation-triangle" class="size-4 shrink-0" />
          <span>Points must be divisible by 50.</span>
        </div>
        <div v-if="turnPoints > 0 && turnPoints < MIN_STASH_POINTS" class="alert alert-warning py-2">
          <Icon name="heroicons:exclamation-triangle" class="size-4 shrink-0" />
          <span>Need at least {{ MIN_STASH_POINTS }} points this roll to bank or stash.<span v-if="stashedPoints > 0"> Rolling under {{ MIN_STASH_POINTS }} loses your {{ stashedPoints }} stashed points too.</span></span>
        </div>
        <div class="flex gap-3">
          <button class="btn btn-info flex-1 gap-2" :disabled="turnPoints < MIN_STASH_POINTS || isNotDivisibleBy50" @click="stashPoints">
            <Icon name="heroicons:archive-box-arrow-down" class="size-4" /> Stash
          </button>
          <button class="btn btn-success flex-1 gap-2" :disabled="turnPoints < MIN_STASH_POINTS || isNotDivisibleBy50" @click="bank">
            <Icon name="heroicons:banknotes" class="size-4" /> Bank
          </button>
          <button class="btn btn-error flex-1 gap-2" @click="farkle">
            <Icon name="heroicons:fire" class="size-4" /> Farkle
          </button>
        </div>

        <div class="card-actions justify-end mt-2">
          <button class="btn btn-neutral btn-sm gap-2" @click="endGame">
            <Icon name="heroicons:flag" class="size-4" /> End Game
          </button>
        </div>
    </AppCard>

  <!-- Lobby -->
  <GameLobby v-else />
</template>
