import type { Game, GamePlayer, Turn } from '~/interfaces'
import { deriveGameState } from './deriveGameState'

/**
 * The table handles the projection needs, so the same code can run against the live
 * `db` and against a Dexie upgrade transaction (which exposes tables via `tx.table`).
 */
export interface ProjectionTables {
  games: {
    update: (id: number, changes: Partial<Game>) => Promise<unknown>
  }
  gamePlayers: {
    where: (index: string) => { equals: (value: number) => { sortBy: (key: string) => Promise<GamePlayer[]> } }
    update: (id: number, changes: Partial<GamePlayer>) => Promise<unknown>
  }
  turns: {
    where: (index: string) => { equals: (value: number) => { sortBy: (key: string) => Promise<Turn[]> } }
  }
}

/**
 * Replays the turn log and writes the derived standings back onto `gamePlayers` and
 * `games`. This is the only place the projection is written — the v3 upgrade hook in
 * `db/index.ts` calls it too, so a change to the projection shape cannot leave the
 * migration behind.
 */
export async function writeProjection(tables: ProjectionTables, gameId: number) {
  const gamePlayers = await tables.gamePlayers.where('gameId').equals(gameId).sortBy('turnOrder')
  const turns = await tables.turns.where('gameId').equals(gameId).sortBy('turnNumber')
  const { standings, currentGamePlayerId } = deriveGameState(gamePlayers, turns)

  for (const standing of standings) {
    await tables.gamePlayers.update(standing.gamePlayerId, {
      totalScore: standing.totalScore,
      consecutiveFarkles: standing.consecutiveFarkles,
    })
  }

  if (gamePlayers.length > 0) {
    await tables.games.update(gameId, { currentGamePlayerId })
  }
}
