import Dexie, { type EntityTable } from 'dexie'
import type { Game, Player, GamePlayer, Turn } from '~/interfaces'
import { writeProjection, type ProjectionTables } from '~/game/projection'
export type { Game, Player, GamePlayer, Turn } from '~/interfaces'

class AppDatabase extends Dexie {
  games!: EntityTable<Game, 'id'>
  players!: EntityTable<Player, 'id'>
  gamePlayers!: EntityTable<GamePlayer, 'id'>
  turns!: EntityTable<Turn, 'id'>

  constructor() {
    super('10k-db')
    this.version(2).stores({
      games:       '++id, status',
      players:     '++id, name',
      gamePlayers: '++id, gameId, playerId, [gameId+turnOrder]',
      turns:       '++id, gameId, gamePlayerId',
    })
    this.version(3).stores({
      turns: '++id, gameId, gamePlayerId, [gameId+turnNumber]',
    }).upgrade(async (tx) => {
      // Backfill projections that predate the turn log being the source of truth.
      // Shares writeProjection with the engine so the two cannot drift apart.
      const tables = {
        games: tx.table('games'),
        gamePlayers: tx.table('gamePlayers'),
        turns: tx.table('turns'),
      } as unknown as ProjectionTables

      const games = await tx.table<Game, number>('games').toArray()
      for (const game of games) {
        await writeProjection(tables, game.id)
      }
    })
  }
}

export const db = new AppDatabase()
