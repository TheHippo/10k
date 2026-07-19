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

export interface PlayerStanding {
  gamePlayerId: number
  totalScore: number
  consecutiveFarkles: number
}

export interface TurnBreakdown {
  turnNumber: number
  round: number
  gamePlayerId: number
  farkled: boolean
  pointsBanked: number
  penalty: number
  netPoints: number
  runningTotal: number
}

export interface RoundBreakdown {
  round: number
  turns: TurnBreakdown[]
}

export interface DerivedGameState {
  standings: PlayerStanding[]
  rounds: RoundBreakdown[]
  currentGamePlayerId: number
}
