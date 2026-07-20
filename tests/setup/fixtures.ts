import { db } from '~/db'
import type { Player, Game, GamePlayer } from '~/db'
import { endGame, recordBank, recordFarkle } from '~/game/engine'

export async function seedPlayers(names: string[]): Promise<Player[]> {
  const players: Player[] = []
  for (const name of names) {
    const id = await db.players.add({ name } as Player)
    players.push({ id, name })
  }
  return players
}

export interface GamePlayerOverrides {
  totalScore?: number
  consecutiveFarkles?: number
}

export async function seedActiveGame(
  playerNames: string[],
  overrides: GamePlayerOverrides[] = [],
) {
  const players = await seedPlayers(playerNames)

  const gameId = await db.games.add({
    status: 'active',
    startedAt: new Date(),
    currentGamePlayerId: 0,
  } as Game)

  const gamePlayers: GamePlayer[] = []
  for (let i = 0; i < players.length; i++) {
    const o = overrides[i] ?? {}
    const gpId = await db.gamePlayers.add({
      gameId,
      playerId: players[i].id,
      turnOrder: i,
      totalScore: o.totalScore ?? 0,
      consecutiveFarkles: o.consecutiveFarkles ?? 0,
    } as GamePlayer)
    gamePlayers.push({
      id: gpId,
      gameId,
      playerId: players[i].id,
      turnOrder: i,
      totalScore: o.totalScore ?? 0,
      consecutiveFarkles: o.consecutiveFarkles ?? 0,
    })
  }

  await db.games.update(gameId, { currentGamePlayerId: gamePlayers[0].id })
  const game = (await db.games.get(gameId)) as Game

  return { game, players, gamePlayers }
}

export interface TurnSeed {
  gamePlayerIndex: number
  points?: number
  farkled?: boolean
}

/** Replays turns through the real engine so totalScore/consecutiveFarkles/currentGamePlayerId land where a real game would leave them. */
export async function seedTurns(gameId: number, gamePlayers: GamePlayer[], seeds: TurnSeed[]) {
  for (const seed of seeds) {
    const gp = gamePlayers[seed.gamePlayerIndex]!
    if (seed.farkled) await recordFarkle(gameId, gp.id)
    else await recordBank(gameId, gp.id, seed.points ?? 0)
  }
}

/**
 * Finishes a game. Pass `scores` to set totals directly (fast, but the game has no turn
 * log), or `options.turns` to play them out through the engine when the test needs the
 * round breakdown to render.
 */
export async function seedFinishedGame(
  playerNames: string[],
  scores: number[],
  options: { startedAt?: Date, finishedAt?: Date, turns?: TurnSeed[] } = {},
) {
  const seed = await seedActiveGame(
    playerNames,
    options.turns ? [] : scores.map(totalScore => ({ totalScore })),
  )

  if (options.turns) {
    await seedTurns(seed.game.id, seed.gamePlayers, options.turns)
  }

  // Finish through the real engine so the winner rule is never duplicated here — a
  // regression in endGame must be able to fail these tests.
  await endGame(seed.game.id)
  await db.games.update(seed.game.id, {
    startedAt: options.startedAt ?? seed.game.startedAt,
    finishedAt: options.finishedAt ?? new Date(),
  })

  const game = (await db.games.get(seed.game.id)) as Game
  return { ...seed, game }
}
