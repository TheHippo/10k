import { describe, expect, it } from 'vitest'
import HistoryPage from '~/pages/history.vue'
import AppCard from '~/components/AppCard.vue'
import { db } from '~/db'
import { mountWithStubs } from '../setup/mount'
import { seedActiveGame, seedFinishedGame } from '../setup/fixtures'
import { waitFor } from '../setup/dom'

describe('pages/history.vue', () => {
  it('shows an empty state when there are no finished games', async () => {
    const wrapper = await mountWithStubs(HistoryPage)
    await waitFor(() => expect(wrapper.text()).toContain('No games finished yet.'))
  })

  it('never lists active (non-finished) games', async () => {
    await seedActiveGame(['Alice', 'Bob'])
    await seedFinishedGame(['Cara', 'Dan'], [12000, 4000])

    const wrapper = await mountWithStubs(HistoryPage)
    await waitFor(() => expect(wrapper.findAllComponents(AppCard)).toHaveLength(1))
  })

  it('sorts finished games by startedAt descending', async () => {
    const oldest = await seedFinishedGame(['Alice', 'Bob'], [11000, 200], { startedAt: new Date(2024, 0, 1) })
    const middle = await seedFinishedGame(['Cara', 'Dan'], [11000, 200], { startedAt: new Date(2024, 6, 1) })
    const newest = await seedFinishedGame(['Eve', 'Finn'], [11000, 200], { startedAt: new Date(2025, 0, 1) })

    const wrapper = await mountWithStubs(HistoryPage)
    await waitFor(() => expect(wrapper.findAllComponents(AppCard)).toHaveLength(3))

    const cards = wrapper.findAllComponents(AppCard)
    expect(cards[0]!.text()).toContain(newest.game.startedAt.toLocaleDateString())
    expect(cards[1]!.text()).toContain(middle.game.startedAt.toLocaleDateString())
    expect(cards[2]!.text()).toContain(oldest.game.startedAt.toLocaleDateString())
  })

  it('shows a trophy for a winner reaching 10000, and "Aborted" otherwise', async () => {
    await seedFinishedGame(['Alice', 'Bob'], [12000, 4000])
    await seedFinishedGame(['Cara', 'Dan'], [5000, 3000])

    const wrapper = await mountWithStubs(HistoryPage)
    await waitFor(() => expect(wrapper.findAllComponents(AppCard)).toHaveLength(2))

    const texts = wrapper.findAllComponents(AppCard).map(c => c.text())
    expect(texts.some(t => t.includes('🏆') && t.includes('Alice'))).toBe(true)
    expect(texts.some(t => t.includes('Aborted'))).toBe(true)
  })

  it('renders the round breakdown from the finished game\'s turn log', async () => {
    // Games seeded with scores alone have no turns, so this is the only path that
    // exercises deriveGameState on the history page.
    await seedFinishedGame(['Alice', 'Bob'], [], {
      turns: [
        { gamePlayerIndex: 0, points: 12000 },
        { gamePlayerIndex: 1, points: 400 },
        { gamePlayerIndex: 0, farkled: true },
        { gamePlayerIndex: 1, points: 350 },
      ],
    })

    const wrapper = await mountWithStubs(HistoryPage)

    // Wait on the content, not the card count: the live query emits an early snapshot
    // where the turns exist but the projection has not been written yet.
    await waitFor(() => {
      const text = wrapper.text()
      expect(text).toContain('+12,000')
      expect(text).toContain('FARKLE')
      expect(text).toContain('+350')
      // Alice's 12,000 came from the replayed log, so the trophy proves it was read.
      expect(text).toContain('🏆')
      expect(text).toContain('750')
    })
  })

  it('names the winner Unknown when the winning row is missing', async () => {
    const seed = await seedFinishedGame(['Alice', 'Bob'], [12000, 4000])
    await db.gamePlayers.delete(seed.gamePlayers[0]!.id)

    const wrapper = await mountWithStubs(HistoryPage)
    await waitFor(() => expect(wrapper.findAllComponents(AppCard)).toHaveLength(1))
    expect(wrapper.text()).toContain('Aborted')
  })

  it('hideAborted filters the list and persists across a remount', async () => {
    await seedFinishedGame(['Alice', 'Bob'], [12000, 4000])
    await seedFinishedGame(['Cara', 'Dan'], [5000, 3000])

    const wrapper = await mountWithStubs(HistoryPage)
    await waitFor(() => expect(wrapper.findAllComponents(AppCard)).toHaveLength(2))

    await wrapper.get('input.toggle').setValue(true)

    await waitFor(() => expect(wrapper.findAllComponents(AppCard)).toHaveLength(1))
    expect(wrapper.text()).toContain('Alice')
    expect(localStorage.getItem('history:hideAborted')).toBe('true')

    const remounted = await mountWithStubs(HistoryPage)
    await waitFor(() => expect(remounted.findAllComponents(AppCard)).toHaveLength(1))
  })
})
