import { describe, expect, it } from 'vitest'
import { db } from '~/db'
import { deriveGameState, recordBank, recordFarkle, undoLastTurn } from '~/game/engine'
import type { GamePlayer, Turn } from '~/interfaces'
import { seedActiveGame } from '../setup/fixtures'

function makeGamePlayers(count: number): GamePlayer[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    gameId: 1,
    playerId: i + 1,
    turnOrder: i,
    totalScore: 0,
    consecutiveFarkles: 0,
  }))
}

function makeTurn(turnNumber: number, gamePlayerId: number, overrides: Partial<Turn> = {}): Turn {
  return {
    id: turnNumber,
    gameId: 1,
    gamePlayerId,
    turnNumber,
    pointsBanked: 0,
    farkled: false,
    createdAt: new Date(),
    ...overrides,
  }
}

describe('deriveGameState (pure replay)', () => {
  it('computes per-player totals from a replayed turn sequence', () => {
    const players = makeGamePlayers(2)
    const turns = [
      makeTurn(1, 1, { pointsBanked: 500 }),
      makeTurn(2, 2, { pointsBanked: 300 }),
      makeTurn(3, 1, { pointsBanked: 200 }),
    ]

    const { standings, currentGamePlayerId } = deriveGameState(players, turns)

    expect(standings.find(s => s.gamePlayerId === 1)?.totalScore).toBe(700)
    expect(standings.find(s => s.gamePlayerId === 2)?.totalScore).toBe(300)
    expect(currentGamePlayerId).toBe(2)
  })

  it('applies a -1000 penalty on the 3rd consecutive farkle and resets the streak', () => {
    const players = makeGamePlayers(2)
    const turns = [
      makeTurn(1, 1, { farkled: true }),
      makeTurn(2, 2, { pointsBanked: 100 }),
      makeTurn(3, 1, { farkled: true }),
      makeTurn(4, 2, { pointsBanked: 100 }),
      makeTurn(5, 1, { farkled: true }),
    ]

    const { standings } = deriveGameState(players, turns)
    const alice = standings.find(s => s.gamePlayerId === 1)

    expect(alice?.totalScore).toBe(-1000)
    expect(alice?.consecutiveFarkles).toBe(0)
  })

  it('derives the current player via round-robin rotation, including wrap-around', () => {
    const players = makeGamePlayers(3)

    expect(deriveGameState(players, []).currentGamePlayerId).toBe(1)
    expect(deriveGameState(players, [makeTurn(1, 1), makeTurn(2, 1)]).currentGamePlayerId).toBe(3)
    expect(deriveGameState(players, [makeTurn(1, 1), makeTurn(2, 1), makeTurn(3, 1)]).currentGamePlayerId).toBe(1)
  })

  it.each([2, 3, 4, 5, 6])('groups two full rounds correctly for %i players', (numPlayers) => {
    const players = makeGamePlayers(numPlayers)
    const turns: Turn[] = []
    for (let round = 0; round < 2; round++) {
      for (let p = 0; p < numPlayers; p++) {
        turns.push(makeTurn(round * numPlayers + p + 1, p + 1, { pointsBanked: 100 }))
      }
    }

    const { rounds } = deriveGameState(players, turns)

    expect(rounds).toHaveLength(2)
    expect(rounds[0]!.round).toBe(1)
    expect(rounds[0]!.turns).toHaveLength(numPlayers)
    expect(rounds[1]!.round).toBe(2)
    expect(rounds[1]!.turns).toHaveLength(numPlayers)
  })
})

describe('engine db-mutation helpers', () => {
  it('recordBank appends a turn, credits the player, and advances the current player', async () => {
    const { game, gamePlayers } = await seedActiveGame(['Alice', 'Bob'])

    await recordBank(game.id, gamePlayers[0]!.id, 750)

    const turns = await db.turns.where('gameId').equals(game.id).toArray()
    expect(turns).toHaveLength(1)
    expect(turns[0]).toMatchObject({ gamePlayerId: gamePlayers[0]!.id, pointsBanked: 750, farkled: false, turnNumber: 1 })

    const alice = await db.gamePlayers.get(gamePlayers[0]!.id)
    expect(alice?.totalScore).toBe(750)
    expect(alice?.consecutiveFarkles).toBe(0)

    const updatedGame = await db.games.get(game.id)
    expect(updatedGame?.currentGamePlayerId).toBe(gamePlayers[1]!.id)
  })

  it('recordFarkle applies the -1000 penalty on the 3rd consecutive farkle', async () => {
    const { game, gamePlayers } = await seedActiveGame(['Alice', 'Bob'])

    await recordFarkle(game.id, gamePlayers[0]!.id)
    await recordFarkle(game.id, gamePlayers[0]!.id)
    await recordFarkle(game.id, gamePlayers[0]!.id)

    const alice = await db.gamePlayers.get(gamePlayers[0]!.id)
    expect(alice?.totalScore).toBe(-1000)
    expect(alice?.consecutiveFarkles).toBe(0)
  })

  it('undoLastTurn removes the last turn and recomputes totals, streak, and current player', async () => {
    const { game, gamePlayers } = await seedActiveGame(['Alice', 'Bob'])

    await recordBank(game.id, gamePlayers[0]!.id, 500)
    await recordFarkle(game.id, gamePlayers[1]!.id)
    await recordFarkle(game.id, gamePlayers[1]!.id)

    await undoLastTurn(game.id)

    const turns = await db.turns.where('gameId').equals(game.id).toArray()
    expect(turns).toHaveLength(2)

    const bob = await db.gamePlayers.get(gamePlayers[1]!.id)
    expect(bob?.consecutiveFarkles).toBe(1)
    expect(bob?.totalScore).toBe(0)

    const updatedGame = await db.games.get(game.id)
    expect(updatedGame?.currentGamePlayerId).toBe(gamePlayers[0]!.id)
  })

  it('undoing a penalty-triggering farkle rolls the -1000 penalty back', async () => {
    const { game, gamePlayers } = await seedActiveGame(['Alice', 'Bob'])

    await recordFarkle(game.id, gamePlayers[0]!.id)
    await recordFarkle(game.id, gamePlayers[0]!.id)
    await recordFarkle(game.id, gamePlayers[0]!.id)

    await undoLastTurn(game.id)

    const alice = await db.gamePlayers.get(gamePlayers[0]!.id)
    expect(alice?.totalScore).toBe(0)
    expect(alice?.consecutiveFarkles).toBe(2)
  })

  it('undoLastTurn on a game with no turns is a no-op', async () => {
    const { game } = await seedActiveGame(['Alice', 'Bob'])

    await undoLastTurn(game.id)

    const turns = await db.turns.where('gameId').equals(game.id).toArray()
    expect(turns).toHaveLength(0)
  })
})
