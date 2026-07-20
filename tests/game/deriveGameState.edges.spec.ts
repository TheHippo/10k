import { describe, expect, it } from 'vitest'
import { deriveGameState } from '~/game/deriveGameState'
import type { GamePlayer, Turn } from '~/interfaces'

function gp(id: number, turnOrder: number): GamePlayer {
  return { id, gameId: 1, playerId: id, turnOrder, totalScore: 0, consecutiveFarkles: 0 }
}

function turn(turnNumber: number, gamePlayerId: number, over: Partial<Turn> = {}): Turn {
  return { id: turnNumber, gameId: 1, gamePlayerId, turnNumber, pointsBanked: 0, farkled: false, createdAt: new Date(), ...over }
}

describe('deriveGameState edge cases', () => {
  it('returns an empty state for a game with no players', () => {
    const state = deriveGameState([], [])
    expect(state.standings).toEqual([])
    expect(state.rounds).toEqual([])
    expect(state.currentGamePlayerId).toBe(0)
  })

  it('ignores turns belonging to a player who is no longer in the game', () => {
    const state = deriveGameState([gp(1, 0), gp(2, 1)], [
      turn(1, 1, { pointsBanked: 400 }),
      turn(2, 99, { pointsBanked: 9999 }), // removed player
    ])

    expect(state.standings.map(s => s.totalScore)).toEqual([400, 0])
    // The orphan turn still occupies a slot, so it must not shift whose turn it is.
    expect(state.rounds.flatMap(r => r.turns).map(t => t.gamePlayerId)).toEqual([1])
  })

  it('sorts players by turnOrder regardless of the order given', () => {
    const state = deriveGameState([gp(2, 1), gp(1, 0)], [])
    expect(state.currentGamePlayerId).toBe(1)
  })

  it('replays turns in turnNumber order even when given shuffled', () => {
    const ordered = deriveGameState([gp(1, 0)], [
      turn(1, 1, { farkled: true }),
      turn(2, 1, { farkled: true }),
      turn(3, 1, { farkled: true }),
    ])
    const shuffled = deriveGameState([gp(1, 0)], [
      turn(3, 1, { farkled: true }),
      turn(1, 1, { farkled: true }),
      turn(2, 1, { farkled: true }),
    ])

    expect(shuffled.standings).toEqual(ordered.standings)
    expect(shuffled.standings[0]!.totalScore).toBe(-1000)
  })

  it('groups turns into rounds by player count', () => {
    const state = deriveGameState([gp(1, 0), gp(2, 1), gp(3, 2)], [
      turn(1, 1, { pointsBanked: 100 }),
      turn(2, 2, { pointsBanked: 100 }),
      turn(3, 3, { pointsBanked: 100 }),
      turn(4, 1, { pointsBanked: 100 }),
    ])

    expect(state.rounds.map(r => r.round)).toEqual([1, 2])
    expect(state.rounds[0]!.turns).toHaveLength(3)
    expect(state.rounds[1]!.turns).toHaveLength(1)
  })

  it('a non-farkle turn clears an in-progress farkle streak', () => {
    const state = deriveGameState([gp(1, 0)], [
      turn(1, 1, { farkled: true }),
      turn(2, 1, { farkled: true }),
      turn(3, 1, { pointsBanked: 350 }),
      turn(4, 1, { farkled: true }),
    ])

    // Without the reset this would have been a third farkle and a -1000 penalty.
    expect(state.standings[0]!.totalScore).toBe(350)
    expect(state.standings[0]!.consecutiveFarkles).toBe(1)
  })

  it('applies a penalty on every third farkle, not just the first time', () => {
    const farkles = Array.from({ length: 6 }, (_, i) => turn(i + 1, 1, { farkled: true }))
    const state = deriveGameState([gp(1, 0)], farkles)

    expect(state.standings[0]!.totalScore).toBe(-2000)
    expect(state.standings[0]!.consecutiveFarkles).toBe(0)
  })
})
