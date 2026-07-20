import { describe, expect, it } from 'vitest'
import RoundBreakdown from '~/components/RoundBreakdown.vue'
import { FARKLE_PENALTY } from '~/constants/game'
import type { GamePlayerWithName, RoundBreakdown as RoundBreakdownEntry } from '~/interfaces'
import { mountWithStubs } from '../setup/mount'

function player(id: number, playerName: string): GamePlayerWithName {
  return { id, gameId: 1, playerId: id, turnOrder: id - 1, totalScore: 0, consecutiveFarkles: 0, playerName }
}

function turn(gamePlayerId: number, over: Partial<RoundBreakdownEntry['turns'][number]> = {}) {
  return {
    turnNumber: 1, round: 1, gamePlayerId,
    farkled: false, pointsBanked: 0, penalty: 0, netPoints: 0, runningTotal: 0,
    ...over,
  }
}

const alice = player(1, 'Alice')
const bob = player(2, 'Bob')

function mount(rounds: RoundBreakdownEntry[], players = [alice, bob]) {
  return mountWithStubs(RoundBreakdown, { props: { rounds, players } })
}

describe('RoundBreakdown', () => {
  it('shows an empty state before any turn is played', async () => {
    const wrapper = await mount([])
    expect(wrapper.text()).toContain('No rounds recorded yet.')
    expect(wrapper.find('table').exists()).toBe(false)
  })

  it('renders banked points with a running total', async () => {
    const wrapper = await mount([
      { round: 1, turns: [turn(alice.id, { pointsBanked: 400, netPoints: 400, runningTotal: 400 })] },
    ])
    expect(wrapper.text()).toContain('+400')
    expect(wrapper.text()).toContain('400')
  })

  it('renders a plain farkle without a penalty', async () => {
    const wrapper = await mount([
      { round: 1, turns: [turn(alice.id, { farkled: true })] },
    ])
    expect(wrapper.text()).toContain('FARKLE')
    expect(wrapper.text()).not.toContain('(')
  })

  it('renders the penalty alongside a third farkle', async () => {
    const wrapper = await mount([
      { round: 1, turns: [turn(alice.id, { farkled: true, penalty: FARKLE_PENALTY, netPoints: FARKLE_PENALTY, runningTotal: -1000 })] },
    ])
    expect(wrapper.text()).toContain('FARKLE (-1,000)')
  })

  it('shows a dash where a player has not played that round', async () => {
    const wrapper = await mount([
      { round: 1, turns: [turn(alice.id, { pointsBanked: 400 })] },
    ])
    const cells = wrapper.findAll('tbody td')
    // Round number, Alice's turn, then Bob's untaken turn.
    expect(cells[2]!.text()).toBe('—')
  })

  it('orders columns by the players it is given, not by the turn order within a round', async () => {
    const wrapper = await mount([
      { round: 1, turns: [turn(bob.id, { pointsBanked: 100 }), turn(alice.id, { pointsBanked: 400 })] },
    ])
    const headers = wrapper.findAll('thead th').map(th => th.text())
    expect(headers).toEqual(['Round', 'Alice', 'Bob'])

    const cells = wrapper.findAll('tbody td').map(td => td.text())
    expect(cells[1]).toContain('+400') // Alice's column
    expect(cells[2]).toContain('+100') // Bob's column
  })

  it('formats large running totals with separators', async () => {
    const wrapper = await mount([
      { round: 1, turns: [turn(alice.id, { pointsBanked: 12000, netPoints: 12000, runningTotal: 12350 })] },
    ])
    expect(wrapper.text()).toContain('+12,000')
    expect(wrapper.text()).toContain('12,350')
  })

  it('lists one row per round in order', async () => {
    const wrapper = await mount([
      { round: 1, turns: [turn(alice.id, { pointsBanked: 400 })] },
      { round: 2, turns: [turn(alice.id, { turnNumber: 3, round: 2, pointsBanked: 350 })] },
    ])
    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('1')
    expect(rows[1]!.text()).toContain('2')
  })
})
