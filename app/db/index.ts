import Dexie, { type EntityTable } from 'dexie'
import type { Game, Player, GamePlayer, Turn } from '~/interfaces'
import { deriveGameState } from '~/game/deriveGameState'
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
      const games = await tx.table<Game, number>('games').toArray()
      for (const game of games) {
        const gamePlayers = await tx.table<GamePlayer, number>('gamePlayers').where('gameId').equals(game.id).sortBy('turnOrder')
        const turns = await tx.table<Turn, number>('turns').where('gameId').equals(game.id).sortBy('turnNumber')
        const { standings, currentGamePlayerId } = deriveGameState(gamePlayers, turns)

        for (const standing of standings) {
          await tx.table<GamePlayer, number>('gamePlayers').update(standing.gamePlayerId, {
            totalScore: standing.totalScore,
            consecutiveFarkles: standing.consecutiveFarkles,
          })
        }

        if (gamePlayers.length > 0) {
          await tx.table<Game, number>('games').update(game.id, { currentGamePlayerId })
        }
      }
    })
  }
}

export const db = new AppDatabase()
