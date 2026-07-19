import { FARKLE_PENALTY, MAX_CONSECUTIVE_FARKLES } from '~/constants/game'
import type { DerivedGameState, GamePlayer, PlayerStanding, RoundBreakdown, Turn, TurnBreakdown } from '~/interfaces'

export function deriveGameState(gamePlayers: GamePlayer[], turns: Turn[]): DerivedGameState {
  const orderedPlayers = [...gamePlayers].sort((a, b) => a.turnOrder - b.turnOrder)
  const numPlayers = orderedPlayers.length

  const standingsById = new Map<number, PlayerStanding>(
    orderedPlayers.map(gp => [gp.id, { gamePlayerId: gp.id, totalScore: 0, consecutiveFarkles: 0 }]),
  )

  const roundsById = new Map<number, TurnBreakdown[]>()

  const orderedTurns = [...turns].sort((a, b) => a.turnNumber - b.turnNumber)
  for (const turn of orderedTurns) {
    const standing = standingsById.get(turn.gamePlayerId)
    if (!standing) continue

    let penalty = 0
    if (turn.farkled) {
      standing.consecutiveFarkles += 1
      if (standing.consecutiveFarkles >= MAX_CONSECUTIVE_FARKLES) {
        penalty = FARKLE_PENALTY
        standing.consecutiveFarkles = 0
      }
    } else {
      standing.consecutiveFarkles = 0
    }

    const netPoints = turn.farkled ? penalty : turn.pointsBanked
    standing.totalScore += netPoints

    const round = numPlayers > 0 ? Math.floor((turn.turnNumber - 1) / numPlayers) + 1 : 1
    const breakdown: TurnBreakdown = {
      turnNumber: turn.turnNumber,
      round,
      gamePlayerId: turn.gamePlayerId,
      farkled: turn.farkled,
      pointsBanked: turn.pointsBanked,
      penalty,
      netPoints,
      runningTotal: standing.totalScore,
    }

    const roundTurns = roundsById.get(round)
    if (roundTurns) roundTurns.push(breakdown)
    else roundsById.set(round, [breakdown])
  }

  const rounds: RoundBreakdown[] = [...roundsById.entries()]
    .sort(([a], [b]) => a - b)
    .map(([round, turns]) => ({ round, turns }))

  const currentGamePlayerId = numPlayers > 0
    ? orderedPlayers[orderedTurns.length % numPlayers]!.id
    : 0

  return {
    standings: [...standingsById.values()],
    rounds,
    currentGamePlayerId,
  }
}
