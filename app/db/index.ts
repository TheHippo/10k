import Dexie, { type EntityTable } from 'dexie'
import type { Game, Player, GamePlayer, Turn } from '~/interfaces'
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
  }
}

export const db = new AppDatabase()
