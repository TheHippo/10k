import { describe, expect, it } from 'vitest'
import IndexPage from '~/pages/index.vue'
import { db } from '~/db'
import { MIN_STASH_POINTS, THREE_PAIRS_POINTS, STRAIGHT_POINTS } from '~/constants/game'
import { mountWithStubs } from '../setup/mount'
import { seedActiveGame } from '../setup/fixtures'
import { click, clickButtonWithText, waitFor } from '../setup/dom'

async function waitForGameReady(wrapper: Awaited<ReturnType<typeof mountWithStubs>>, playerNames: string[]) {
  await waitFor(() => {
    expect(wrapper.text()).toContain('Game in Progress')
    for (const name of playerNames) expect(wrapper.text()).toContain(name)
  })
}

async function mountActiveGame(...args: Parameters<typeof seedActiveGame>) {
  const seed = await seedActiveGame(...args)
  const wrapper = await mountWithStubs(IndexPage)
  await waitForGameReady(wrapper, args[0])
  return { ...seed, wrapper }
}

describe('pages/index.vue turn engine', () => {
  it('disables Stash/Bank and warns below the minimum stash points', async () => {
    const { wrapper } = await mountActiveGame(['Alice', 'Bob'])

    await wrapper.get('input[type="number"]').setValue(MIN_STASH_POINTS - 50)

    expect(wrapper.text()).toContain(`Need at least ${MIN_STASH_POINTS} points`)
    expect(wrapper.get('button.btn-info').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button.btn-success').attributes('disabled')).toBeDefined()
  })

  it('warns and disables actions when points are not divisible by 50', async () => {
    const { wrapper } = await mountActiveGame(['Alice', 'Bob'])

    await wrapper.get('input[type="number"]').setValue(MIN_STASH_POINTS + 25)

    expect(wrapper.text()).toContain('Points must be divisible by 50.')
    expect(wrapper.get('button.btn-info').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button.btn-success').attributes('disabled')).toBeDefined()
  })

  it('the quick-fill button sets turnPoints to the minimum stash points', async () => {
    const { wrapper } = await mountActiveGame(['Alice', 'Bob'])

    await clickButtonWithText(wrapper, String(MIN_STASH_POINTS))

    expect((wrapper.get('input[type="number"]').element as HTMLInputElement).value).toBe(String(MIN_STASH_POINTS))
    expect(wrapper.get('button.btn-info').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('button.btn-success').attributes('disabled')).toBeUndefined()
  })

  it('stash moves turnPoints into stashedPoints and resets turnPoints', async () => {
    const { wrapper } = await mountActiveGame(['Alice', 'Bob'])

    await wrapper.get('input[type="number"]').setValue(MIN_STASH_POINTS)
    await click(wrapper, 'button.btn-info')

    expect(wrapper.text()).toContain(`Stashed: ${MIN_STASH_POINTS} pts`)
    expect((wrapper.get('input[type="number"]').element as HTMLInputElement).value).toBe('0')
  })

  it('accumulates stashed points across multiple qualifying rolls', async () => {
    const { wrapper } = await mountActiveGame(['Alice', 'Bob'])

    await wrapper.get('input[type="number"]').setValue(350)
    await click(wrapper, 'button.btn-info')
    await wrapper.get('input[type="number"]').setValue(400)
    await click(wrapper, 'button.btn-info')

    expect(wrapper.text()).toContain('Stashed: 750 pts')
  })

  it('stashThreePairs adds a fixed bonus and resets turnPoints regardless of current value', async () => {
    const { wrapper } = await mountActiveGame(['Alice', 'Bob'])

    await wrapper.get('input[type="number"]').setValue(999)
    await clickButtonWithText(wrapper, 'Three Pairs')

    expect(wrapper.text()).toContain(`Stashed: ${THREE_PAIRS_POINTS} pts`)
    expect((wrapper.get('input[type="number"]').element as HTMLInputElement).value).toBe('0')
  })

  it('stashStraight adds a fixed bonus and resets turnPoints regardless of current value', async () => {
    const { wrapper } = await mountActiveGame(['Alice', 'Bob'])

    await wrapper.get('input[type="number"]').setValue(999)
    await clickButtonWithText(wrapper, 'Straight 1')

    expect(wrapper.text()).toContain(`Stashed: ${STRAIGHT_POINTS} pts`)
    expect((wrapper.get('input[type="number"]').element as HTMLInputElement).value).toBe('0')
  })

  it('bank commits stashed+turn points, resets the farkle streak, and advances the turn', async () => {
    const { game, gamePlayers, wrapper } = await mountActiveGame(
      ['Alice', 'Bob'],
      [{ consecutiveFarkles: 2 }],
    )

    await wrapper.get('input[type="number"]').setValue(350)
    await click(wrapper, 'button.btn-info')
    await wrapper.get('input[type="number"]').setValue(400)
    await click(wrapper, 'button.btn-success')

    await waitFor(async () => {
      const turns = await db.turns.where('gameId').equals(game.id).toArray()
      expect(turns).toHaveLength(1)
      expect(turns[0]).toMatchObject({ pointsBanked: 750, farkled: false, turnNumber: 1 })

      const alice = await db.gamePlayers.get(gamePlayers[0].id)
      expect(alice?.totalScore).toBe(750)
      expect(alice?.consecutiveFarkles).toBe(0)

      const updatedGame = await db.games.get(game.id)
      expect(updatedGame?.currentGamePlayerId).toBe(gamePlayers[1].id)
    })
  })

  it('farkle records a zero-point turn and increments the streak without penalty', async () => {
    const { game, gamePlayers, wrapper } = await mountActiveGame(
      ['Alice', 'Bob'],
      [{ consecutiveFarkles: 1, totalScore: 500 }],
    )

    await click(wrapper, 'button.btn-error')

    await waitFor(async () => {
      const turns = await db.turns.where('gameId').equals(game.id).toArray()
      expect(turns).toHaveLength(1)
      expect(turns[0]).toMatchObject({ pointsBanked: 0, farkled: true, turnNumber: 1 })

      const alice = await db.gamePlayers.get(gamePlayers[0].id)
      expect(alice?.consecutiveFarkles).toBe(2)
      expect(alice?.totalScore).toBe(500)
    })
  })

  it('the third consecutive farkle applies a -1000 penalty and resets the streak', async () => {
    const { gamePlayers, wrapper } = await mountActiveGame(
      ['Alice', 'Bob'],
      [{ consecutiveFarkles: 2, totalScore: 500 }],
    )

    await click(wrapper, 'button.btn-error')

    await waitFor(async () => {
      const alice = await db.gamePlayers.get(gamePlayers[0].id)
      expect(alice?.consecutiveFarkles).toBe(0)
      expect(alice?.totalScore).toBe(-500)
    })
  })

  it('advances to the next player mid-list', async () => {
    const { game, gamePlayers, wrapper } = await mountActiveGame(['Alice', 'Bob', 'Cara'])

    await click(wrapper, 'button.btn-error')

    await waitFor(async () => {
      const updatedGame = await db.games.get(game.id)
      expect(updatedGame?.currentGamePlayerId).toBe(gamePlayers[1].id)
    })
  })

  it('wraps the turn from the last player back to the first', async () => {
    const players = await seedActiveGame(['Alice', 'Bob', 'Cara'])
    await db.games.update(players.game.id, { currentGamePlayerId: players.gamePlayers[2].id })
    const wrapper = await mountWithStubs(IndexPage)
    await waitForGameReady(wrapper, ['Alice', 'Bob', 'Cara'])

    await click(wrapper, 'button.btn-error')

    await waitFor(async () => {
      const updatedGame = await db.games.get(players.game.id)
      expect(updatedGame?.currentGamePlayerId).toBe(players.gamePlayers[0].id)
    })
  })

  it('endGame assigns the winner as the highest scorer', async () => {
    const { game, gamePlayers, wrapper } = await mountActiveGame(
      ['Alice', 'Bob', 'Cara'],
      [{ totalScore: 8000 }, { totalScore: 12000 }, { totalScore: 5000 }],
    )

    await click(wrapper, 'button.btn-neutral')

    await waitFor(async () => {
      const updated = await db.games.get(game.id)
      expect(updated?.status).toBe('finished')
      expect(updated?.finishedAt).toBeInstanceOf(Date)
      expect(updated?.winnerGamePlayerId).toBe(gamePlayers[1].id)
    })
  })

  it('endGame breaks ties by picking the first matching highest scorer', async () => {
    const { game, gamePlayers, wrapper } = await mountActiveGame(
      ['Alice', 'Bob'],
      [{ totalScore: 5000 }, { totalScore: 5000 }],
    )

    await click(wrapper, 'button.btn-neutral')

    await waitFor(async () => {
      const updated = await db.games.get(game.id)
      expect(updated?.winnerGamePlayerId).toBe(gamePlayers[0].id)
    })
  })
})
