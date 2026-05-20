import Dexie, { type EntityTable } from 'dexie'

export interface Game {
  id: number
  status: 'active' | 'finished'
  startedAt: Date
  finishedAt?: Date
  currentGamePlayerId: number
  winnerGamePlayerId?: number
}

export interface Player {
  id: number
  name: string
}

export interface GamePlayer {
  id: number
  gameId: number
  playerId: number
  turnOrder: number
  totalScore: number
  consecutiveFarkles: number
}

export interface Turn {
  id: number
  gameId: number
  gamePlayerId: number
  turnNumber: number
  pointsBanked: number
  farkled: boolean
  createdAt: Date
}

class AppDatabase extends Dexie {
  games!: EntityTable<Game, 'id'>
  players!: EntityTable<Player, 'id'>
  gamePlayers!: EntityTable<GamePlayer, 'id'>
  turns!: EntityTable<Turn, 'id'>

  constructor() {
    super('10k-db')
    this.version(1).stores({
      games:       '++id, status',
      players:     '++id, name',
      gamePlayers: '++id, gameId, playerId, [gameId+turnOrder]',
      turns:       '++id, gameId, gamePlayerId',
    })
  }
}

export const db = new AppDatabase()
