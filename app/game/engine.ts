import { db } from '~/db'
import type { Turn } from '~/interfaces'
import { deriveGameState } from './deriveGameState'

export { deriveGameState } from './deriveGameState'

export async function rebuildProjection(gameId: number) {
  const gamePlayers = await db.gamePlayers.where('gameId').equals(gameId).sortBy('turnOrder')
  const turns = await db.turns.where('gameId').equals(gameId).sortBy('turnNumber')
  const { standings, currentGamePlayerId } = deriveGameState(gamePlayers, turns)

  await Promise.all(standings.map(s =>
    db.gamePlayers.update(s.gamePlayerId, {
      totalScore: s.totalScore,
      consecutiveFarkles: s.consecutiveFarkles,
    }),
  ))

  if (gamePlayers.length > 0) {
    await db.games.update(gameId, { currentGamePlayerId })
  }
}

async function appendTurn(gameId: number, gamePlayerId: number, pointsBanked: number, farkled: boolean) {
  await db.transaction('rw', db.turns, db.gamePlayers, db.games, async () => {
    const turnCount = await db.turns.where('gameId').equals(gameId).count()
    await db.turns.add({
      gameId,
      gamePlayerId,
      turnNumber: turnCount + 1,
      pointsBanked,
      farkled,
      createdAt: new Date(),
    } as Turn)
    await rebuildProjection(gameId)
  })
}

export function recordBank(gameId: number, gamePlayerId: number, points: number) {
  return appendTurn(gameId, gamePlayerId, points, false)
}

export function recordFarkle(gameId: number, gamePlayerId: number) {
  return appendTurn(gameId, gamePlayerId, 0, true)
}

export async function undoLastTurn(gameId: number) {
  await db.transaction('rw', db.turns, db.gamePlayers, db.games, async () => {
    const turns = await db.turns.where('gameId').equals(gameId).sortBy('turnNumber')
    const last = turns[turns.length - 1]
    if (!last) return
    await db.turns.delete(last.id)
    await rebuildProjection(gameId)
  })
}
