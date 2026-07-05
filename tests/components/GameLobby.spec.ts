import { describe, expect, it } from 'vitest'
import GameLobby from '~/components/GameLobby.vue'
import NewPlayerModal from '~/components/NewPlayerModal.vue'
import { db } from '~/db'
import { mountWithStubs } from '../setup/mount'
import { seedPlayers } from '../setup/fixtures'
import { findButtonByText, selectOptionWithText, waitFor } from '../setup/dom'

async function mountLobby(playerNames: string[]) {
  const players = await seedPlayers(playerNames)
  const wrapper = await mountWithStubs(GameLobby)
  await waitFor(() => {
    for (const name of playerNames) expect(wrapper.text()).toContain(name)
  })
  return { players, wrapper }
}

describe('GameLobby', () => {
  it('starts with two player-select rows', async () => {
    const { wrapper } = await mountLobby(['Alice', 'Bob'])
    expect(wrapper.findAll('select')).toHaveLength(2)
  })

  it('caps "Add Player" at 6 rows', async () => {
    const { wrapper } = await mountLobby(['Alice', 'Bob', 'Cara', 'Dan', 'Eve', 'Finn'])

    for (let i = 0; i < 5; i++) {
      await findButtonByText(wrapper, 'Add Player').trigger('click')
    }

    expect(wrapper.findAll('select')).toHaveLength(6)
    expect(findButtonByText(wrapper, 'Add Player').attributes('disabled')).toBeDefined()
  })

  it('disables "Remove Player" at the minimum of two rows', async () => {
    const { wrapper } = await mountLobby(['Alice', 'Bob'])
    const removeButtons = wrapper.findAll('button.btn-ghost.btn-square')
    expect(removeButtons).toHaveLength(2)
    for (const btn of removeButtons) {
      expect(btn.attributes('disabled')).toBeDefined()
    }
  })

  it('removes a row when above the minimum', async () => {
    const { wrapper } = await mountLobby(['Alice', 'Bob', 'Cara'])
    await findButtonByText(wrapper, 'Add Player').trigger('click')
    expect(wrapper.findAll('select')).toHaveLength(3)

    await wrapper.findAll('button.btn-ghost.btn-square')[2]!.trigger('click')
    expect(wrapper.findAll('select')).toHaveLength(2)
  })

  it('disables a player in other rows once selected', async () => {
    const { players, wrapper } = await mountLobby(['Alice', 'Bob', 'Cara'])
    const selects = wrapper.findAll('select')
    await selectOptionWithText(selects[0]!, players[0]!.name)

    const optionInOtherRow = selects[1]!
      .findAll('option')
      .find(o => o.text() === players[0]!.name)
    expect((optionInOtherRow!.element as HTMLOptionElement).disabled).toBe(true)
  })

  it('disables Start Game while any row is unselected', async () => {
    const { players, wrapper } = await mountLobby(['Alice', 'Bob'])
    expect(findButtonByText(wrapper, 'Start Game').attributes('disabled')).toBeDefined()

    const selects = wrapper.findAll('select')
    await selectOptionWithText(selects[0]!, players[0]!.name)
    await selectOptionWithText(selects[1]!, players[1]!.name)

    expect(findButtonByText(wrapper, 'Start Game').attributes('disabled')).toBeUndefined()
  })

  it('startGame creates one Game and N GamePlayer rows with correct turnOrder', async () => {
    const { players, wrapper } = await mountLobby(['Alice', 'Bob', 'Cara'])
    const selects = wrapper.findAll('select')
    await selectOptionWithText(selects[0]!, players[1]!.name)
    await selectOptionWithText(selects[1]!, players[2]!.name)

    await findButtonByText(wrapper, 'Start Game').trigger('click')

    await waitFor(async () => {
      const games = await db.games.where('status').equals('active').toArray()
      expect(games).toHaveLength(1)
      const game = games[0]!

      const gamePlayers = await db.gamePlayers.where('gameId').equals(game.id).sortBy('turnOrder')
      expect(gamePlayers).toHaveLength(2)
      expect(gamePlayers[0]).toMatchObject({
        playerId: players[1]!.id, turnOrder: 0, totalScore: 0, consecutiveFarkles: 0,
      })
      expect(gamePlayers[1]).toMatchObject({
        playerId: players[2]!.id, turnOrder: 1, totalScore: 0, consecutiveFarkles: 0,
      })
      expect(game.currentGamePlayerId).toBe(gamePlayers[0]!.id)
    })

    expect(wrapper.findAll('select')).toHaveLength(2)
  })

  it('auto-selects a newly created player into the first empty slot', async () => {
    const { players, wrapper } = await mountLobby(['Alice'])
    const selects = wrapper.findAll('select')
    await selectOptionWithText(selects[0]!, players[0]!.name)

    const modal = wrapper.findComponent(NewPlayerModal)
    await modal.get('input[type="text"]').setValue('Zoe')
    await modal.get('button.btn-primary').trigger('click')

    await waitFor(async () => {
      const zoe = await db.players.where('name').equals('Zoe').first()
      expect(zoe).toBeDefined()
      expect((wrapper.findAll('select')[1]!.element as HTMLSelectElement).value).toBe(String(zoe!.id))
    })
  })
})
