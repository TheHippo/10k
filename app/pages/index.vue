<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { db } from '~/db'
import { MIN_STASH_POINTS, THREE_PAIRS_POINTS, STRAIGHT_POINTS, HIGH_SCORE_CONFIRM_THRESHOLD } from '~/constants/game'
import { deriveGameState, recordBank, recordFarkle, undoLastTurn } from '~/game/engine'
import type { Game, GamePlayerWithName, Turn } from '~/interfaces'

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

const activeTurns = useLiveQuery<Turn[]>(async () => {
  const game = await db.games.where('status').equals('active').first()
  if (!game) return []
  return db.turns.where('gameId').equals(game.id).sortBy('turnNumber')
}, [])

const derivedRounds = computed(() => deriveGameState(activeGamePlayers.value, activeTurns.value).rounds)

const lastTurnBreakdown = computed(() => {
  const lastRound = derivedRounds.value[derivedRounds.value.length - 1]
  return lastRound ? lastRound.turns[lastRound.turns.length - 1]! : null
})

const lastTurnPlayerName = computed(() =>
  activeGamePlayers.value.find(p => p.id === lastTurnBreakdown.value?.gamePlayerId)?.playerName ?? '',
)

useWakeLock(computed(() => !!activeGame.value))

// --- Active game ---

const turnPoints = ref(0)
const stashedPoints = ref(0)
const isNotDivisibleBy50 = computed(() => turnPoints.value > 0 && turnPoints.value % 50 !== 0)

const highScoreDialogRef = ref<HTMLDialogElement | null>(null)
let pendingHighScoreAction: (() => void) | null = null

function withHighScoreConfirm(action: () => void) {
  if (turnPoints.value > HIGH_SCORE_CONFIRM_THRESHOLD) {
    pendingHighScoreAction = action
    highScoreDialogRef.value?.showModal()
  } else {
    action()
  }
}

function confirmHighScore() {
  const action = pendingHighScoreAction
  highScoreDialogRef.value?.close()
  action?.()
}

const undoDialogRef = ref<HTMLDialogElement | null>(null)

function openUndoDialog() {
  undoDialogRef.value?.showModal()
}

async function confirmUndo() {
  if (!activeGame.value) return
  undoDialogRef.value?.close()
  await undoLastTurn(activeGame.value.id)
  refocusPointsInput()
}

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
  await recordBank(game.id, gp.id, total)

  turnPoints.value = 0
  stashedPoints.value = 0
  refocusPointsInput()
}

async function farkle() {
  if (!activeGame.value) return
  const game = activeGame.value
  const gp = activeGamePlayers.value.find(p => p.id === game.currentGamePlayerId)
  if (!gp) return

  await recordFarkle(game.id, gp.id)

  stashedPoints.value = 0
  refocusPointsInput()
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
  <h1 v-if="activeGame" class="mb-4">Game in Progress</h1>
  <AppCard v-if="activeGame">
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

        <div class="join w-full">
          <input
            ref="pointsInputRef"
            v-model.number="turnPoints"
            type="number"
            min="0"
            step="50"
            placeholder="Points scored this roll"
            class="input input-bordered join-item grow"
          />
          <button
            type="button"
            class="btn btn-outline join-item px-3"
            :disabled="!!turnPoints"
            @click="turnPoints = MIN_STASH_POINTS"
          >
            {{ MIN_STASH_POINTS }}
          </button>
        </div>
        <div v-if="isNotDivisibleBy50 && turnPoints >= MIN_STASH_POINTS" class="alert alert-warning py-2">
          <Icon name="heroicons:exclamation-triangle" class="size-4 shrink-0" />
          <span>Points must be divisible by 50.</span>
        </div>
        <div v-if="turnPoints > 0 && turnPoints < MIN_STASH_POINTS" class="alert alert-warning py-2">
          <Icon name="heroicons:exclamation-triangle" class="size-4 shrink-0" />
          <span>Need at least {{ MIN_STASH_POINTS }} points this roll to bank or stash.<span v-if="stashedPoints > 0"> Rolling under {{ MIN_STASH_POINTS }} loses your {{ stashedPoints }} stashed points too.</span></span>
        </div>
        <div class="flex gap-3">
          <button class="btn btn-info flex-1 gap-2" :disabled="turnPoints < MIN_STASH_POINTS || isNotDivisibleBy50" @click="withHighScoreConfirm(stashPoints)">
            <Icon name="heroicons:archive-box-arrow-down" class="size-4" /> Stash
          </button>
          <button class="btn btn-success flex-1 gap-2" :disabled="turnPoints < MIN_STASH_POINTS || isNotDivisibleBy50" @click="withHighScoreConfirm(bank)">
            <Icon name="heroicons:banknotes" class="size-4" /> Bank
          </button>
          <button class="btn btn-error flex-1 gap-2" @click="farkle">
            <Icon name="heroicons:fire" class="size-4" /> Farkle
          </button>
        </div>

        <div class="card-actions justify-end mt-2">
          <button class="btn btn-outline btn-sm gap-2" :disabled="activeTurns.length === 0" @click="openUndoDialog">
            <Icon name="heroicons:arrow-uturn-left" class="size-4" /> Undo
          </button>
          <button class="btn btn-neutral btn-sm gap-2" @click="endGame">
            <Icon name="heroicons:flag" class="size-4" /> End Game
          </button>
        </div>

        <div class="collapse collapse-arrow bg-base-100 mt-2">
          <input type="checkbox" />
          <div class="collapse-title text-sm font-medium py-2 min-h-0">Round breakdown</div>
          <div class="collapse-content">
            <RoundBreakdown :rounds="derivedRounds" :players="activeGamePlayers" />
          </div>
        </div>

        <dialog ref="highScoreDialogRef" class="modal" @close="pendingHighScoreAction = null">
          <div class="modal-box">
            <h3 class="font-bold text-lg mb-4">Confirm high score</h3>
            <p>You entered <strong>{{ turnPoints }}</strong> points this roll. Did you actually score that many?</p>
            <div class="modal-action">
              <button class="btn btn-ghost gap-2" @click="highScoreDialogRef?.close()">
                <Icon name="heroicons:x-mark" class="size-4" /> Cancel
              </button>
              <button class="btn btn-primary gap-2" @click="confirmHighScore">
                <Icon name="heroicons:check" class="size-4" /> Yes, that's correct
              </button>
            </div>
          </div>
          <form method="dialog" class="modal-backdrop"><button>close</button></form>
        </dialog>

        <dialog ref="undoDialogRef" class="modal">
          <div class="modal-box">
            <h3 class="font-bold text-lg mb-4">Undo last turn</h3>
            <p v-if="lastTurnBreakdown">
              Undo <strong>{{ lastTurnPlayerName }}</strong>'s Round {{ lastTurnBreakdown.round }} turn
              (<template v-if="lastTurnBreakdown.farkled">Farkle<template v-if="lastTurnBreakdown.penalty !== 0"> · {{ lastTurnBreakdown.penalty }} pts</template></template><template v-else>+{{ lastTurnBreakdown.pointsBanked }} pts</template>)?
            </p>
            <div class="modal-action">
              <button class="btn btn-ghost gap-2" @click="undoDialogRef?.close()">
                <Icon name="heroicons:x-mark" class="size-4" /> Cancel
              </button>
              <button class="btn btn-primary gap-2" @click="confirmUndo">
                <Icon name="heroicons:arrow-uturn-left" class="size-4" /> Yes, undo
              </button>
            </div>
          </div>
          <form method="dialog" class="modal-backdrop"><button>close</button></form>
        </dialog>
    </AppCard>

  <!-- Lobby -->
  <GameLobby v-else />
</template>
