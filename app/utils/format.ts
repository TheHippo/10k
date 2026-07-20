import type { TurnBreakdown } from '~/interfaces'

/** Thousands-separated score, so the same number never renders two ways across screens. */
export function formatScore(points: number): string {
  return points.toLocaleString()
}

/** Signed points for a single turn, e.g. "+400" or "-1000". */
export function formatDelta(points: number): string {
  return `${points > 0 ? '+' : ''}${formatScore(points)}`
}

/**
 * How a turn reads in a breakdown cell or a confirmation prompt:
 * "+400", "FARKLE", or "FARKLE (-1000)" when the third farkle carried a penalty.
 */
export function formatTurnResult(turn: Pick<TurnBreakdown, 'farkled' | 'penalty' | 'pointsBanked'>): string {
  if (!turn.farkled) return formatDelta(turn.pointsBanked)
  return turn.penalty !== 0 ? `FARKLE (${formatScore(turn.penalty)})` : 'FARKLE'
}
