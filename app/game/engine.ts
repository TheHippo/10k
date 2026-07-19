import { db } from '~/db'
import type { Game, GamePlayer, Turn } from '~/interfaces'
import { writeProjection } from './projection'

export { deriveGameState } from './deriveGameState'

export function rebuildProjection(gameId: number) {
  return writeProjection(db, gameId)
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

/** Creates a game with the given players in the given turn order. */
export async function startGame(playerIds: number[]): Promise<number> {
  return db.transaction('rw', db.games, db.gamePlayers, async () => {
    const gameId = await db.games.add({
      status: 'active',
      startedAt: new Date(),
      currentGamePlayerId: 0,
    } as Game)

    let firstGamePlayerId = 0
    for (const [turnOrder, playerId] of playerIds.entries()) {
      const id = await db.gamePlayers.add({
        gameId, playerId, turnOrder, totalScore: 0, consecutiveFarkles: 0,
      } as GamePlayer)
      if (turnOrder === 0) firstGamePlayerId = id
    }

    await db.games.update(gameId, { currentGamePlayerId: firstGamePlayerId })
    return gameId
  })
}

/** Finishes a game, awarding it to the highest scorer. Ties go to the earliest turn order. */
export async function endGame(gameId: number) {
  const gamePlayers = await db.gamePlayers.where('gameId').equals(gameId).sortBy('turnOrder')
  const winner = [...gamePlayers].sort((a, b) => b.totalScore - a.totalScore)[0]

  await db.games.update(gameId, {
    status: 'finished',
    finishedAt: new Date(),
    winnerGamePlayerId: winner?.id,
  })
}
