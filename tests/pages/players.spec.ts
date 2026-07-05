import { describe, expect, it } from 'vitest'
import PlayersPage from '~/pages/players.vue'
import { db } from '~/db'
import { mountWithStubs } from '../setup/mount'
import { seedPlayers } from '../setup/fixtures'
import { waitFor } from '../setup/dom'

describe('pages/players.vue', () => {
  it('shows an empty state when there are no players', async () => {
    const wrapper = await mountWithStubs(PlayersPage)
    await waitFor(() => expect(wrapper.text()).toContain('No players yet.'))
  })

  it('lists only non-deleted players, sorted by name', async () => {
    const [, bob] = await seedPlayers(['Zoe', 'Bob', 'Alice'])
    await db.players.update(bob!.id, { deleted: true })

    const wrapper = await mountWithStubs(PlayersPage)
    await waitFor(() => expect(wrapper.findAll('li')).toHaveLength(2))

    const names = wrapper.findAll('li').map(li => li.text())
    expect(names[0]).toContain('Alice')
    expect(names[1]).toContain('Zoe')
    expect(wrapper.text()).not.toContain('Bob')
  })

  it('soft-deletes a player via the confirm dialog, without removing the row', async () => {
    await seedPlayers(['Alice'])
    const wrapper = await mountWithStubs(PlayersPage)
    await waitFor(() => expect(wrapper.findAll('li')).toHaveLength(1))

    await wrapper.get('button.btn-ghost.btn-square.text-error').trigger('click')
    expect(wrapper.text()).toContain('Remove')
    expect(wrapper.text()).toContain('Alice')

    await wrapper.get('button.btn-error.gap-2').trigger('click')

    await waitFor(async () => {
      const alice = await db.players.where('name').equals('Alice').first()
      expect(alice?.deleted).toBe(true)
      expect(await db.players.count()).toBe(1)
    })
    await waitFor(() => expect(wrapper.findAll('li')).toHaveLength(0))
  })

  it('shows a newly created player reactively without remounting', async () => {
    const wrapper = await mountWithStubs(PlayersPage)
    await waitFor(() => expect(wrapper.text()).toContain('No players yet.'))

    await db.players.add({ name: 'Late Joiner' } as any)

    await waitFor(() => expect(wrapper.text()).toContain('Late Joiner'))
  })
})
