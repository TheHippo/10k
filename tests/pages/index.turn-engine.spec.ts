import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import IndexPage from '~/pages/index.vue'
import { db } from '~/db'
import { MIN_STASH_POINTS, THREE_PAIRS_POINTS, STRAIGHT_POINTS, HIGH_SCORE_CONFIRM_THRESHOLD } from '~/constants/game'
import { formatScore } from '~/utils/format'
import { mountWithStubs } from '../setup/mount'
import { seedActiveGame, seedTurns } from '../setup/fixtures'
import { clickButton, dialogTitled, getButton, waitFor } from '../setup/dom'

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
  describe('screen wake lock', () => {
    let requestMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
      const sentinel = { release: vi.fn(), addEventListener: vi.fn() }
      requestMock = vi.fn(async () => sentinel)
      vi.stubGlobal('navigator', { ...navigator, wakeLock: { request: requestMock } })
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('requests a wake lock once a game is in progress', async () => {
      await mountActiveGame(['Alice', 'Bob'])

      await waitFor(() => expect(requestMock).toHaveBeenCalledWith('screen'))
    })

    it('does not request a wake lock in the lobby', async () => {
      const wrapper = await mountWithStubs(IndexPage)
      await waitFor(() => expect(wrapper.text()).not.toContain('Game in Progress'))
      await new Promise(resolve => setTimeout(resolve, 20))

      expect(requestMock).not.toHaveBeenCalled()
    })
  })

  it('disables Stash/Bank and warns below the minimum stash points', async () => {
    const { wrapper } = await mountActiveGame(['Alice', 'Bob'])

    await wrapper.get('input[type="number"]').setValue(MIN_STASH_POINTS - 50)

    expect(wrapper.text()).toContain(`Need at least ${MIN_STASH_POINTS} points`)
    expect(getButton(wrapper, 'Stash').attributes('disabled')).toBeDefined()
    expect(getButton(wrapper, 'Bank').attributes('disabled')).toBeDefined()
  })

  it('warns and disables actions when points are not divisible by 50', async () => {
    const { wrapper } = await mountActiveGame(['Alice', 'Bob'])

    await wrapper.get('input[type="number"]').setValue(MIN_STASH_POINTS + 25)

    expect(wrapper.text()).toContain('Points must be divisible by 50.')
    expect(getButton(wrapper, 'Stash').attributes('disabled')).toBeDefined()
    expect(getButton(wrapper, 'Bank').attributes('disabled')).toBeDefined()
  })

  it('focuses the points input once a game is in progress', async () => {
    const focusSpy = vi.spyOn(HTMLInputElement.prototype, 'focus')

    await mountActiveGame(['Alice', 'Bob'])

    await waitFor(() => {
      expect(focusSpy).toHaveBeenCalled()
    })
    focusSpy.mockRestore()
  })

  it('refocuses the points input after farkle so the on-screen keyboard stays open', async () => {
    const { wrapper } = await mountActiveGame(['Alice', 'Bob'])
    const focusSpy = vi.spyOn(HTMLInputElement.prototype, 'focus')

    await clickButton(wrapper, 'Farkle')

    await waitFor(() => {
      expect(focusSpy).toHaveBeenCalled()
    })
    focusSpy.mockRestore()
  })

  it('the quick-fill button sets turnPoints to the minimum stash points', async () => {
    const { wrapper } = await mountActiveGame(['Alice', 'Bob'])

    await clickButton(wrapper, String(MIN_STASH_POINTS))

    expect((wrapper.get('input[type="number"]').element as HTMLInputElement).value).toBe(String(MIN_STASH_POINTS))
    expect(getButton(wrapper, 'Stash').attributes('disabled')).toBeUndefined()
    expect(getButton(wrapper, 'Bank').attributes('disabled')).toBeUndefined()
  })

  it('disables the quick-fill button once the input has a value', async () => {
    const { wrapper } = await mountActiveGame(['Alice', 'Bob'])

    const quickFillButton = getButton(wrapper, String(MIN_STASH_POINTS))
    expect(quickFillButton.attributes('disabled')).toBeUndefined()

    await wrapper.get('input[type="number"]').setValue(50)

    expect(quickFillButton.attributes('disabled')).toBeDefined()

    await wrapper.get('input[type="number"]').setValue(0)

    expect(quickFillButton.attributes('disabled')).toBeUndefined()
  })

  it('stash moves turnPoints into stashedPoints and resets turnPoints', async () => {
    const { wrapper } = await mountActiveGame(['Alice', 'Bob'])

    await wrapper.get('input[type="number"]').setValue(MIN_STASH_POINTS)
    await clickButton(wrapper, 'Stash')

    expect(wrapper.text()).toContain(`Stashed: ${formatScore(MIN_STASH_POINTS)} pts`)
    expect((wrapper.get('input[type="number"]').element as HTMLInputElement).value).toBe('0')
  })

  it('accumulates stashed points across multiple qualifying rolls', async () => {
    const { wrapper } = await mountActiveGame(['Alice', 'Bob'])

    await wrapper.get('input[type="number"]').setValue(350)
    await clickButton(wrapper, 'Stash')
    await wrapper.get('input[type="number"]').setValue(400)
    await clickButton(wrapper, 'Stash')

    expect(wrapper.text()).toContain('Stashed: 750 pts')
  })

  it('stashThreePairs adds a fixed bonus and resets turnPoints regardless of current value', async () => {
    const { wrapper } = await mountActiveGame(['Alice', 'Bob'])

    await wrapper.get('input[type="number"]').setValue(999)
    await clickButton(wrapper, 'Three Pairs')

    expect(wrapper.text()).toContain(`Stashed: ${formatScore(THREE_PAIRS_POINTS)} pts`)
    expect((wrapper.get('input[type="number"]').element as HTMLInputElement).value).toBe('0')
  })

  it('stashStraight adds a fixed bonus and resets turnPoints regardless of current value', async () => {
    const { wrapper } = await mountActiveGame(['Alice', 'Bob'])

    await wrapper.get('input[type="number"]').setValue(999)
    await clickButton(wrapper, 'Straight 1')

    expect(wrapper.text()).toContain(`Stashed: ${formatScore(STRAIGHT_POINTS)} pts`)
    expect((wrapper.get('input[type="number"]').element as HTMLInputElement).value).toBe('0')
  })

  it('shows a confirmation dialog before banking an unusually high score', async () => {
    const { wrapper } = await mountActiveGame(['Alice', 'Bob'])

    await wrapper.get('input[type="number"]').setValue(HIGH_SCORE_CONFIRM_THRESHOLD + 50)
    await clickButton(wrapper, 'Bank')

    expect(wrapper.get('dialog').element.open).toBe(true)
    expect(wrapper.text()).toContain('Confirm high score')
  })

  it('does not show the confirmation dialog for scores at or below the threshold', async () => {
    const { game, wrapper } = await mountActiveGame(['Alice', 'Bob'])

    await wrapper.get('input[type="number"]').setValue(HIGH_SCORE_CONFIRM_THRESHOLD)
    await clickButton(wrapper, 'Bank')

    expect(wrapper.get('dialog').element.open).toBe(false)
    await waitFor(async () => {
      const turns = await db.turns.where('gameId').equals(game.id).toArray()
      expect(turns).toHaveLength(1)
    })
  })

  it('proceeds with banking once the high score is confirmed', async () => {
    const { game, wrapper } = await mountActiveGame(['Alice', 'Bob'])

    await wrapper.get('input[type="number"]').setValue(HIGH_SCORE_CONFIRM_THRESHOLD + 50)
    await clickButton(wrapper, 'Bank')
    await clickButton(wrapper, 'Yes, that\'s correct')

    expect(wrapper.get('dialog').element.open).toBe(false)
    await waitFor(async () => {
      const turns = await db.turns.where('gameId').equals(game.id).toArray()
      expect(turns).toHaveLength(1)
      expect(turns[0]).toMatchObject({ pointsBanked: HIGH_SCORE_CONFIRM_THRESHOLD + 50 })
    })
  })

  it('cancels the pending action and keeps turnPoints unchanged when a high score is not confirmed', async () => {
    const { game, wrapper } = await mountActiveGame(['Alice', 'Bob'])

    await wrapper.get('input[type="number"]').setValue(HIGH_SCORE_CONFIRM_THRESHOLD + 50)
    await clickButton(wrapper, 'Bank')
    await clickButton(dialogTitled(wrapper, 'Confirm high score'), 'Cancel')

    expect(wrapper.get('dialog').element.open).toBe(false)
    expect((wrapper.get('input[type="number"]').element as HTMLInputElement).value).toBe(String(HIGH_SCORE_CONFIRM_THRESHOLD + 50))
    const turns = await db.turns.where('gameId').equals(game.id).toArray()
    expect(turns).toHaveLength(0)
  })

  it('bank commits stashed+turn points, resets the farkle streak, and advances the turn', async () => {
    const { game, gamePlayers } = await seedActiveGame(['Alice', 'Bob'])
    // Give Alice a pre-existing 2-farkle streak (interleaved with Bob's turns), current player back to Alice.
    await seedTurns(game.id, gamePlayers, [
      { gamePlayerIndex: 0, farkled: true },
      { gamePlayerIndex: 1, points: 100 },
      { gamePlayerIndex: 0, farkled: true },
      { gamePlayerIndex: 1, points: 100 },
    ])
    const wrapper = await mountWithStubs(IndexPage)
    await waitForGameReady(wrapper, ['Alice', 'Bob'])

    await wrapper.get('input[type="number"]').setValue(350)
    await clickButton(wrapper, 'Stash')
    await wrapper.get('input[type="number"]').setValue(400)
    await clickButton(wrapper, 'Bank')

    await waitFor(async () => {
      const turns = await db.turns.where('gameId').equals(game.id).toArray()
      expect(turns).toHaveLength(5)
      const lastTurn = turns.find(t => t.turnNumber === 5)
      expect(lastTurn).toMatchObject({ pointsBanked: 750, farkled: false, turnNumber: 5 })

      const alice = await db.gamePlayers.get(gamePlayers[0].id)
      expect(alice?.totalScore).toBe(750)
      expect(alice?.consecutiveFarkles).toBe(0)

      const updatedGame = await db.games.get(game.id)
      expect(updatedGame?.currentGamePlayerId).toBe(gamePlayers[1].id)
    })
  })

  it('farkle records a zero-point turn and increments the streak without penalty', async () => {
    const { game, gamePlayers } = await seedActiveGame(['Alice', 'Bob'])
    // Alice already banked 500 and has farkled once since, current player back to Alice.
    await seedTurns(game.id, gamePlayers, [
      { gamePlayerIndex: 0, points: 500 },
      { gamePlayerIndex: 1, points: 100 },
      { gamePlayerIndex: 0, farkled: true },
      { gamePlayerIndex: 1, points: 100 },
    ])
    const wrapper = await mountWithStubs(IndexPage)
    await waitForGameReady(wrapper, ['Alice', 'Bob'])

    await clickButton(wrapper, 'Farkle')

    await waitFor(async () => {
      const turns = await db.turns.where('gameId').equals(game.id).toArray()
      expect(turns).toHaveLength(5)
      const lastTurn = turns.find(t => t.turnNumber === 5)
      expect(lastTurn).toMatchObject({ pointsBanked: 0, farkled: true, turnNumber: 5 })

      const alice = await db.gamePlayers.get(gamePlayers[0].id)
      expect(alice?.consecutiveFarkles).toBe(2)
      expect(alice?.totalScore).toBe(500)
    })
  })

  it('the third consecutive farkle applies a -1000 penalty and resets the streak', async () => {
    const { game, gamePlayers } = await seedActiveGame(['Alice', 'Bob'])
    // Alice banked 500, then farkled twice, current player back to Alice.
    await seedTurns(game.id, gamePlayers, [
      { gamePlayerIndex: 0, points: 500 },
      { gamePlayerIndex: 1, points: 100 },
      { gamePlayerIndex: 0, farkled: true },
      { gamePlayerIndex: 1, points: 100 },
      { gamePlayerIndex: 0, farkled: true },
      { gamePlayerIndex: 1, points: 100 },
    ])
    const wrapper = await mountWithStubs(IndexPage)
    await waitForGameReady(wrapper, ['Alice', 'Bob'])

    await clickButton(wrapper, 'Farkle')

    await waitFor(async () => {
      const alice = await db.gamePlayers.get(gamePlayers[0].id)
      expect(alice?.consecutiveFarkles).toBe(0)
      expect(alice?.totalScore).toBe(-500)
    })
  })

  it('advances to the next player mid-list', async () => {
    const { game, gamePlayers, wrapper } = await mountActiveGame(['Alice', 'Bob', 'Cara'])

    await clickButton(wrapper, 'Farkle')

    await waitFor(async () => {
      const updatedGame = await db.games.get(game.id)
      expect(updatedGame?.currentGamePlayerId).toBe(gamePlayers[1].id)
    })
  })

  it('wraps the turn from the last player back to the first', async () => {
    const players = await seedActiveGame(['Alice', 'Bob', 'Cara'])
    await seedTurns(players.game.id, players.gamePlayers, [
      { gamePlayerIndex: 0, points: 100 },
      { gamePlayerIndex: 1, points: 100 },
    ])
    const wrapper = await mountWithStubs(IndexPage)
    await waitForGameReady(wrapper, ['Alice', 'Bob', 'Cara'])

    await clickButton(wrapper, 'Farkle')

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

    await clickButton(wrapper, 'End Game')

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

    await clickButton(wrapper, 'End Game')

    await waitFor(async () => {
      const updated = await db.games.get(game.id)
      expect(updated?.winnerGamePlayerId).toBe(gamePlayers[0].id)
    })
  })

  describe('undo', () => {
    it('disables Undo when there are no turns yet', async () => {
      const { wrapper } = await mountActiveGame(['Alice', 'Bob'])

      expect(getButton(wrapper, 'Undo').attributes('disabled')).toBeDefined()
    })

    it('removes the last banked turn and restores the previous totals and current player', async () => {
      const { game, gamePlayers, wrapper } = await mountActiveGame(['Alice', 'Bob'])

      await wrapper.get('input[type="number"]').setValue(400)
      await clickButton(wrapper, 'Bank')

      await waitFor(async () => {
        const turns = await db.turns.where('gameId').equals(game.id).toArray()
        expect(turns).toHaveLength(1)
      })

      await clickButton(wrapper, 'Undo')
      await clickButton(wrapper, 'Yes, undo')

      await waitFor(async () => {
        const turns = await db.turns.where('gameId').equals(game.id).toArray()
        expect(turns).toHaveLength(0)

        const alice = await db.gamePlayers.get(gamePlayers[0].id)
        expect(alice?.totalScore).toBe(0)

        const updatedGame = await db.games.get(game.id)
        expect(updatedGame?.currentGamePlayerId).toBe(gamePlayers[0].id)
      })
    })

    it('rolls back a penalty-triggering farkle, restoring the streak and points', async () => {
      const { game, gamePlayers } = await seedActiveGame(['Alice', 'Bob'])
      await seedTurns(game.id, gamePlayers, [
        { gamePlayerIndex: 0, farkled: true },
        { gamePlayerIndex: 1, points: 100 },
        { gamePlayerIndex: 0, farkled: true },
        { gamePlayerIndex: 1, points: 100 },
      ])
      const wrapper = await mountWithStubs(IndexPage)
      await waitForGameReady(wrapper, ['Alice', 'Bob'])

      await clickButton(wrapper, 'Farkle')

      await waitFor(async () => {
        const alice = await db.gamePlayers.get(gamePlayers[0].id)
        expect(alice?.totalScore).toBe(-1000)
        expect(alice?.consecutiveFarkles).toBe(0)
      })

      await clickButton(wrapper, 'Undo')
      await clickButton(wrapper, 'Yes, undo')

      await waitFor(async () => {
        const alice = await db.gamePlayers.get(gamePlayers[0].id)
        expect(alice?.totalScore).toBe(0)
        expect(alice?.consecutiveFarkles).toBe(2)
      })
    })
  })

  describe('round breakdown', () => {
    it('renders each played turn grouped by round', async () => {
      const { wrapper } = await mountActiveGame(['Alice', 'Bob'])

      await wrapper.get('input[type="number"]').setValue(400)
      await clickButton(wrapper, 'Bank')

      await waitFor(() => {
        const bobRow = wrapper.findAll('tbody tr').find(r => r.text().includes('Bob'))
        expect(bobRow?.text()).toContain('current')
      })

      await clickButton(wrapper, 'Farkle')

      await waitFor(() => {
        expect(wrapper.text()).toContain('Round 1')
        expect(wrapper.text()).toContain('+400')
        expect(wrapper.text()).toContain('FARKLE')
      })
    })
  })
})
