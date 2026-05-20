<script setup lang="ts">
import { ref } from 'vue'
import { db } from '~/db'
import type { Game, Player, GamePlayer, Turn } from '~/db'

interface GamePlayerWithName extends GamePlayer {
  playerName: string
}

interface FinishedGameSummary {
  game: Game
  players: GamePlayerWithName[]
  winnerName: string
}

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

const finishedGames = useLiveQuery<FinishedGameSummary[]>(async () => {
  const games = await db.games.where('status').equals('finished').toArray()
  games.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
  return Promise.all(games.map(async (game) => {
    const gps = await db.gamePlayers.where('gameId').equals(game.id).sortBy('turnOrder')
    const players = await Promise.all(gps.map(async (gp) => {
      const player = await db.players.get(gp.playerId)
      return { ...gp, playerName: player?.name ?? 'Unknown' }
    }))
    const winner = players.find(p => p.id === game.winnerGamePlayerId)
    return { game, players, winnerName: winner?.playerName ?? 'Unknown' }
  }))
}, [])

// --- Lobby ---

const playerNames = ref(['', ''])

function addPlayer() {
  if (playerNames.value.length < 6) playerNames.value.push('')
}

function removePlayer(i: number) {
  playerNames.value.splice(i, 1)
}

async function startGame() {
  const names = playerNames.value.map(n => n.trim()).filter(Boolean)
  if (names.length < 2) return

  await db.transaction('rw', db.games, db.players, db.gamePlayers, async () => {
    const playerIds: number[] = await Promise.all(names.map(async (name) => {
      const existing = await db.players.where('name').equals(name).first()
      return existing ? existing.id : db.players.add({ name } as Player)
    }))

    const gameId = await db.games.add({
      status: 'active',
      startedAt: new Date(),
      currentGamePlayerId: 0,
    } as Game)

    const firstId = await db.gamePlayers.add({
      gameId, playerId: playerIds[0], turnOrder: 0, totalScore: 0, consecutiveFarkles: 0,
    } as GamePlayer)

    for (let i = 1; i < playerIds.length; i++) {
      await db.gamePlayers.add({
        gameId, playerId: playerIds[i], turnOrder: i, totalScore: 0, consecutiveFarkles: 0,
      } as GamePlayer)
    }

    await db.games.update(gameId, { currentGamePlayerId: firstId })
  })

  playerNames.value = ['', '']
}

// --- Active game ---

const turnPoints = ref(0)
const stashedPoints = ref(0)

function stashPoints() {
  if (turnPoints.value < 350) return
  stashedPoints.value += turnPoints.value
  turnPoints.value = 0
}

async function bank() {
  if (!activeGame.value || turnPoints.value < 350) return
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
  <div class="max-w-2xl mx-auto py-8 space-y-8">

    <!-- Active game -->
    <div v-if="activeGame" class="card bg-base-200 shadow">
      <div class="card-body">
        <h1 class="card-title text-2xl">Game in Progress</h1>

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
          <span>Stashed: <strong>{{ stashedPoints }} pts</strong> — roll all 6 again, need ≥ 350 this roll</span>
        </div>

        <div class="flex items-center gap-3">
          <input
            v-model.number="turnPoints"
            type="number"
            min="0"
            step="50"
            placeholder="Points scored this roll"
            class="input input-bordered flex-1"
          />
          <button class="btn btn-info" :disabled="turnPoints < 350" @click="stashPoints">
            Stash & Roll Again
          </button>
          <button class="btn btn-success" :disabled="turnPoints < 350" @click="bank">
            Bank
          </button>
          <button class="btn btn-error" @click="farkle">
            Farkle
          </button>
        </div>
        <p v-if="turnPoints > 0 && turnPoints < 350" class="text-sm text-warning">
          Need at least 350 points this roll to bank or stash.<span v-if="stashedPoints > 0"> Rolling under 350 loses your {{ stashedPoints }} stashed points too.</span>
        </p>

        <div class="card-actions justify-end mt-2">
          <button class="btn btn-ghost btn-sm" @click="endGame">End Game</button>
        </div>
      </div>
    </div>

    <!-- Lobby -->
    <div v-else class="card bg-base-200 shadow">
      <div class="card-body">
        <h1 class="card-title text-2xl">New Game</h1>

        <div class="space-y-2">
          <div v-for="(_, i) in playerNames" :key="i" class="flex gap-2">
            <input
              v-model="playerNames[i]"
              :placeholder="`Player ${i + 1}`"
              class="input input-bordered flex-1"
            />
            <button
              class="btn btn-ghost btn-square"
              :disabled="playerNames.length <= 2"
              @click="removePlayer(i)"
            >✕</button>
          </div>
        </div>

        <div class="card-actions justify-between mt-4">
          <button
            class="btn btn-ghost btn-sm"
            :disabled="playerNames.length >= 6"
            @click="addPlayer"
          >+ Add Player</button>
          <button
            class="btn btn-primary"
            :disabled="playerNames.filter(n => n.trim()).length < 2"
            @click="startGame"
          >Start Game</button>
        </div>
      </div>
    </div>

    <!-- History -->
    <div v-if="finishedGames.length > 0">
      <h2 class="text-xl font-bold mb-3">Past Games</h2>
      <div class="space-y-4">
        <div v-for="summary in finishedGames" :key="summary.game.id" class="card bg-base-200 shadow-sm">
          <div class="card-body py-4">
            <div class="flex justify-between items-center">
              <span class="font-semibold">{{ summary.game.startedAt.toLocaleDateString() }}</span>
              <span class="badge badge-accent">Winner: {{ summary.winnerName }}</span>
            </div>
            <div class="flex gap-4 flex-wrap text-sm mt-1">
              <span v-for="p in summary.players" :key="p.id" class="font-mono">
                {{ p.playerName }}: {{ p.totalScore }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>
