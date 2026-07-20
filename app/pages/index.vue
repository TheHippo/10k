<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { MIN_STASH_POINTS, THREE_PAIRS_POINTS, STRAIGHT_POINTS, HIGH_SCORE_CONFIRM_THRESHOLD, WIN_TARGET } from '~/constants/game'
import { deriveGameState, endGame, recordBank, recordFarkle, undoLastTurn } from '~/game/engine'

const active = useActiveGame()
const activeGame = computed(() => active.value.game)
const activeGamePlayers = computed(() => active.value.players)
const activeTurns = computed(() => active.value.turns)

const derivedRounds = computed(() => deriveGameState(activeGamePlayers.value, activeTurns.value).rounds)

const lastTurnBreakdown = computed(() => {
  const lastRound = derivedRounds.value[derivedRounds.value.length - 1]
  return lastRound ? lastRound.turns[lastRound.turns.length - 1]! : null
})

const lastTurnPlayerName = computed(() =>
  activeGamePlayers.value.find(p => p.id === lastTurnBreakdown.value?.gamePlayerId)?.playerName ?? '',
)

/** The player whose turn it is, or null if the game is over or not yet loaded. */
const currentPlayer = computed(() =>
  activeGamePlayers.value.find(p => p.id === activeGame.value?.currentGamePlayerId) ?? null,
)

useWakeLock(computed(() => !!activeGame.value))

// --- Turn entry ---

const turnPoints = ref(0)
const stashedPoints = ref(0)
const isNotDivisibleBy50 = computed(() => turnPoints.value > 0 && turnPoints.value % 50 !== 0)
const canScore = computed(() => turnPoints.value >= MIN_STASH_POINTS && !isNotDivisibleBy50.value)

const highScoreModal = ref<{ open: () => void, close: () => void } | null>(null)
const undoModal = ref<{ open: () => void, close: () => void } | null>(null)
const endGameModal = ref<{ open: () => void, close: () => void } | null>(null)
let pendingHighScoreAction: (() => void) | null = null

function withHighScoreConfirm(action: () => void) {
  if (turnPoints.value > HIGH_SCORE_CONFIRM_THRESHOLD) {
    pendingHighScoreAction = action
    highScoreModal.value?.open()
  } else {
    action()
  }
}

function confirmHighScore() {
  const action = pendingHighScoreAction
  highScoreModal.value?.close()
  action?.()
}

async function confirmUndo() {
  const game = activeGame.value
  if (!game) return
  undoModal.value?.close()
  await undoLastTurn(game.id)
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

/** Moves points into the stash without banking them. Defaults to the entered roll. */
function stash(amount = turnPoints.value) {
  if (amount < MIN_STASH_POINTS) return
  stashedPoints.value += amount
  turnPoints.value = 0
  refocusPointsInput()
}

async function bank() {
  const game = activeGame.value
  const gp = currentPlayer.value
  if (!game || !gp || !canScore.value) return

  await recordBank(game.id, gp.id, stashedPoints.value + turnPoints.value)

  turnPoints.value = 0
  stashedPoints.value = 0
  refocusPointsInput()
}

async function farkle() {
  const game = activeGame.value
  const gp = currentPlayer.value
  if (!game || !gp) return

  await recordFarkle(game.id, gp.id)

  // A farkle forfeits the stash along with the roll.
  stashedPoints.value = 0
  refocusPointsInput()
}

/**
 * Who ending the game right now would award it to. Shown in the confirmation so the
 * consequence is visible, but the app deliberately does not judge whether the target
 * has been reached or the final round has been played — that stays with the players.
 */
const prospectiveWinner = computed(() =>
  [...activeGamePlayers.value].sort((a, b) => b.totalScore - a.totalScore)[0] ?? null,
)

async function confirmEndGame() {
  const game = activeGame.value
  if (!game) return
  endGameModal.value?.close()
  await endGame(game.id)
}
</script>

<template>
  <template v-if="activeGame">
    <h1 class="mb-4">Game in Progress</h1>
    <AppCard>
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
            <td class="text-right font-mono font-bold">{{ formatScore(gp.totalScore) }}</td>
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
        <span>Stashed: <strong>{{ formatScore(stashedPoints) }} pts</strong> — roll all 6 again, need ≥ {{ MIN_STASH_POINTS }} this roll</span>
      </div>

      <div class="flex gap-2">
        <button class="btn btn-outline btn-sm flex-1 gap-2" @click="stash(THREE_PAIRS_POINTS)">
          <Icon name="heroicons:squares-2x2" /> Three Pairs ({{ formatDelta(THREE_PAIRS_POINTS) }})
        </button>
        <button class="btn btn-outline btn-sm flex-1 gap-2" @click="stash(STRAIGHT_POINTS)">
          <Icon name="heroicons:bars-4" /> Straight 1–6 ({{ formatDelta(STRAIGHT_POINTS) }})
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
          aria-label="Points scored this roll"
          class="input join-item grow"
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
        <Icon name="heroicons:exclamation-triangle" />
        <span>Points must be divisible by 50.</span>
      </div>
      <div v-if="turnPoints > 0 && turnPoints < MIN_STASH_POINTS" class="alert alert-warning py-2">
        <Icon name="heroicons:exclamation-triangle" />
        <span>Need at least {{ MIN_STASH_POINTS }} points this roll to bank or stash.<span v-if="stashedPoints > 0"> Rolling under {{ MIN_STASH_POINTS }} loses your {{ formatScore(stashedPoints) }} stashed points too.</span></span>
      </div>

      <div class="flex gap-2">
        <button class="btn btn-info flex-1 gap-2" :disabled="!canScore" @click="withHighScoreConfirm(() => stash())">
          <Icon name="heroicons:archive-box-arrow-down" /> Stash
        </button>
        <button class="btn btn-success flex-1 gap-2" :disabled="!canScore" @click="withHighScoreConfirm(bank)">
          <Icon name="heroicons:banknotes" /> Bank
        </button>
        <button class="btn btn-warning flex-1 gap-2" @click="farkle">
          <Icon name="heroicons:fire" /> Farkle
        </button>
      </div>

      <div class="card-actions justify-end mt-4">
        <button class="btn btn-outline btn-sm gap-2" :disabled="activeTurns.length === 0" @click="undoModal?.open()">
          <Icon name="heroicons:arrow-uturn-left" /> Undo
        </button>
        <button class="btn btn-neutral btn-sm gap-2" @click="endGameModal?.open()">
          <Icon name="heroicons:flag" /> End Game
        </button>
      </div>

      <RoundBreakdownPanel :rounds="derivedRounds" :players="activeGamePlayers" />

      <AppModal ref="highScoreModal" title="Confirm high score" @close="pendingHighScoreAction = null">
        <p>You entered <strong>{{ formatScore(turnPoints) }}</strong> points this roll. Did you actually score that many?</p>
        <template #actions>
          <button class="btn btn-primary gap-2" @click="confirmHighScore">
            <Icon name="heroicons:check" /> Yes, that's correct
          </button>
        </template>
      </AppModal>

      <AppModal ref="undoModal" title="Undo last turn">
        <p v-if="lastTurnBreakdown">
          Undo <strong>{{ lastTurnPlayerName }}</strong>'s Round {{ lastTurnBreakdown.round }} turn
          ({{ formatTurnResult(lastTurnBreakdown) }})?
        </p>
        <template #actions>
          <button class="btn btn-primary gap-2" @click="confirmUndo">
            <Icon name="heroicons:arrow-uturn-left" /> Yes, undo
          </button>
        </template>
      </AppModal>

      <AppModal ref="endGameModal" title="End this game?">
        <p v-if="prospectiveWinner">
          This finishes the game and awards it to
          <strong>{{ prospectiveWinner.playerName }}</strong>
          with {{ formatScore(prospectiveWinner.totalScore) }} points.
        </p>
        <p class="text-sm text-base-content/60 mt-2">
          Check that someone has passed {{ formatScore(WIN_TARGET) }} and that everyone
          else has had their final turn.
        </p>
        <template #actions>
          <button class="btn btn-primary gap-2" @click="confirmEndGame">
            <Icon name="heroicons:flag" /> Yes, end game
          </button>
        </template>
      </AppModal>
    </AppCard>
  </template>

  <GameLobby v-else />
</template>
