import { db } from '~/db'
import type { Game, GamePlayer, GamePlayerWithName, Player, Turn } from '~/interfaces'

/**
 * Attaches player names to game players in one bulk read, rather than a `get` per row.
 * Shared by the game page and the history page, which need the same join.
 */
export async function withPlayerNames(gamePlayers: GamePlayer[]): Promise<GamePlayerWithName[]> {
  const players = await db.players.bulkGet(gamePlayers.map(gp => gp.playerId))
  return gamePlayers.map((gp, i) => ({
    ...gp,
    playerName: players[i]?.name ?? 'Unknown',
  }))
}

/** Loads a game's players (in turn order, with names) and its turn log. */
export async function loadGameDetail(gameId: number) {
  const [gamePlayers, turns] = await Promise.all([
    db.gamePlayers.where('gameId').equals(gameId).sortBy('turnOrder'),
    db.turns.where('gameId').equals(gameId).sortBy('turnNumber'),
  ])
  return { gamePlayers, players: await withPlayerNames(gamePlayers), turns }
}

export interface ActiveGameState {
  game: Game | undefined
  players: GamePlayerWithName[]
  turns: Turn[]
}

/**
 * One live subscription covering the active game, its players and its turns.
 * Previously the game page opened three separate subscriptions that each re-ran the
 * same "find the active game" query.
 */
export function useActiveGame() {
  return useLiveQuery<ActiveGameState>(async () => {
    const game = await db.games.where('status').equals('active').first()
    if (!game) return { game: undefined, players: [], turns: [] }
    const { players, turns } = await loadGameDetail(game.id)
    return { game, players, turns }
  }, { game: undefined, players: [], turns: [] })
}

/** The persistent player registry, minus soft-deleted entries. */
export function usePlayers() {
  return useLiveQuery<Player[]>(
    () => db.players.orderBy('name').filter(p => !p.deleted).toArray(),
    [],
  )
}
