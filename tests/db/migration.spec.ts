import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { db } from '~/db'
import { FARKLE_PENALTY } from '~/constants/game'

/**
 * The v3 upgrade replays the turn log to backfill projections written before turns
 * became the source of truth. The shared reset always opens a fresh DB at the latest
 * version, so this path never runs in the rest of the suite.
 *
 * These tests write a real v2 database under the production name and then reopen the
 * production `db`, which makes Dexie run the actual upgrade hook in app/db/index.ts —
 * not a copy of it.
 */

const DB_NAME = '10k-db'

interface SeedTurn { gamePlayerIndex: number, pointsBanked: number, farkled: boolean }

const bank = (gamePlayerIndex: number, pointsBanked: number) => ({ gamePlayerIndex, pointsBanked, farkled: false })
const farkle = (gamePlayerIndex: number) => ({ gamePlayerIndex, pointsBanked: 0, farkled: true })

/**
 * Replaces the database with a v2 one whose stored projections are deliberately wrong
 * (all zeroes), then reopens the production db so the real upgrade runs. The assertions
 * can only pass if the upgrade actually replayed the turns.
 */
async function migrateFromV2(playerNames: string[], turns: SeedTurn[]) {
  db.close()
  await Dexie.delete(DB_NAME)

  const v2 = new Dexie(DB_NAME)
  v2.version(2).stores({
    games: '++id, status',
    players: '++id, name',
    gamePlayers: '++id, gameId, playerId, [gameId+turnOrder]',
    turns: '++id, gameId, gamePlayerId',
  })
  await v2.open()
  expect(v2.verno).toBe(2)

  const gameId = await v2.table('games').add({
    status: 'active', startedAt: new Date(), currentGamePlayerId: 0,
  })

  const gamePlayerIds: number[] = []
  for (const [turnOrder, name] of playerNames.entries()) {
    const playerId = await v2.table('players').add({ name })
    gamePlayerIds.push(await v2.table('gamePlayers').add({
      gameId, playerId, turnOrder, totalScore: 0, consecutiveFarkles: 0,
    }))
  }

  for (const [i, turn] of turns.entries()) {
    await v2.table('turns').add({
      gameId,
      gamePlayerId: gamePlayerIds[turn.gamePlayerIndex],
      turnNumber: i + 1,
      pointsBanked: turn.pointsBanked,
      farkled: turn.farkled,
      createdAt: new Date(),
    })
  }
  v2.close()

  // Runs the production v3 upgrade hook.
  await db.open()
  expect(db.verno).toBe(3)

  return { gameId, gamePlayerIds }
}

describe('db v2 -> v3 migration', () => {
  it('backfills totalScore from the turn log', async () => {
    const { gamePlayerIds } = await migrateFromV2(['Alice', 'Bob'], [
      bank(0, 400), bank(1, 100), bank(0, 500), bank(1, 350),
    ])

    expect((await db.gamePlayers.get(gamePlayerIds[0]!))?.totalScore).toBe(900)
    expect((await db.gamePlayers.get(gamePlayerIds[1]!))?.totalScore).toBe(450)
  })

  it('backfills a third-farkle penalty and the reset streak', async () => {
    const { gamePlayerIds } = await migrateFromV2(['Alice', 'Bob'], [
      bank(0, 500), bank(1, 100),
      farkle(0), bank(1, 100),
      farkle(0), bank(1, 100),
      farkle(0), bank(1, 100),
    ])

    const alice = await db.gamePlayers.get(gamePlayerIds[0]!)
    expect(alice?.totalScore).toBe(500 + FARKLE_PENALTY)
    expect(alice?.consecutiveFarkles).toBe(0)
  })

  it('carries a partial farkle streak forward', async () => {
    const { gamePlayerIds } = await migrateFromV2(['Alice', 'Bob'], [
      bank(0, 500), bank(1, 100),
      farkle(0), bank(1, 100),
      farkle(0), bank(1, 100),
    ])

    const alice = await db.gamePlayers.get(gamePlayerIds[0]!)
    expect(alice?.consecutiveFarkles).toBe(2)
    expect(alice?.totalScore).toBe(500)
  })

  it('restores whose turn it is, wrapping back to the first player', async () => {
    const { gameId, gamePlayerIds } = await migrateFromV2(['Alice', 'Bob', 'Cara'], [
      bank(0, 400), bank(1, 400), bank(2, 400),
    ])

    expect((await db.games.get(gameId))?.currentGamePlayerId).toBe(gamePlayerIds[0])
  })

  it('leaves a game with no turns at zero rather than corrupting it', async () => {
    const { gameId, gamePlayerIds } = await migrateFromV2(['Alice', 'Bob'], [])

    const alice = await db.gamePlayers.get(gamePlayerIds[0]!)
    expect(alice?.totalScore).toBe(0)
    expect(alice?.consecutiveFarkles).toBe(0)
    expect((await db.games.get(gameId))?.currentGamePlayerId).toBe(gamePlayerIds[0])
  })

  it('adds the [gameId+turnNumber] index the new schema relies on', async () => {
    const { gameId } = await migrateFromV2(['Alice', 'Bob'], [bank(0, 400), bank(1, 100)])

    // Would throw if the compound index had not been created by the upgrade.
    const turns = await db.turns.where('[gameId+turnNumber]')
      .between([gameId, Dexie.minKey], [gameId, Dexie.maxKey]).toArray()
    expect(turns.map(t => t.turnNumber)).toEqual([1, 2])
  })
})
