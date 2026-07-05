import { describe, expect, it } from 'vitest'
import HistoryPage from '~/pages/history.vue'
import AppCard from '~/components/AppCard.vue'
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

  it('hideAborted filters the list and persists across a remount', async () => {
    await seedFinishedGame(['Alice', 'Bob'], [12000, 4000])
    await seedFinishedGame(['Cara', 'Dan'], [5000, 3000])

    const wrapper = await mountWithStubs(HistoryPage)
    await waitFor(() => expect(wrapper.findAllComponents(AppCard)).toHaveLength(2))

    await wrapper.get('input[type="checkbox"]').setValue(true)

    await waitFor(() => expect(wrapper.findAllComponents(AppCard)).toHaveLength(1))
    expect(wrapper.text()).toContain('Alice')
    expect(localStorage.getItem('history:hideAborted')).toBe('true')

    const remounted = await mountWithStubs(HistoryPage)
    await waitFor(() => expect(remounted.findAllComponents(AppCard)).toHaveLength(1))
  })
})
