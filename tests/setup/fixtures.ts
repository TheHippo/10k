import { db } from '~/db'
import type { Player, Game, GamePlayer } from '~/db'

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

export async function seedFinishedGame(
  playerNames: string[],
  scores: number[],
  options: { startedAt?: Date, finishedAt?: Date } = {},
) {
  const seed = await seedActiveGame(
    playerNames,
    scores.map(totalScore => ({ totalScore })),
  )
  const winner = [...seed.gamePlayers].sort((a, b) => b.totalScore - a.totalScore)[0]!

  await db.games.update(seed.game.id, {
    status: 'finished',
    startedAt: options.startedAt ?? seed.game.startedAt,
    finishedAt: options.finishedAt ?? new Date(),
    winnerGamePlayerId: winner.id,
  })

  const game = (await db.games.get(seed.game.id)) as Game
  return { ...seed, game }
}
