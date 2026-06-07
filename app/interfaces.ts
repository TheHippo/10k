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
  deleted?: boolean
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

export interface GamePlayerWithName extends GamePlayer {
  playerName: string
}
