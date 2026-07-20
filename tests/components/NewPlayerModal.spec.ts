import { describe, expect, it } from 'vitest'
import NewPlayerModal from '~/components/NewPlayerModal.vue'
import { db } from '~/db'
import { mountWithStubs } from '../setup/mount'
import { clickButton, getButton, waitFor } from '../setup/dom'

describe('NewPlayerModal', () => {
  it('does not create a player for a whitespace-only name', async () => {
    const wrapper = await mountWithStubs(NewPlayerModal)

    await wrapper.get('input[type="text"]').setValue('   ')
    expect(getButton(wrapper, 'Create').attributes('disabled')).toBeDefined()

    expect(await db.players.count()).toBe(0)
  })

  it('creates a player, trims the name, and emits created with the new id', async () => {
    const wrapper = await mountWithStubs(NewPlayerModal)

    await wrapper.get('input[type="text"]').setValue('  Zoe  ')
    await clickButton(wrapper, 'Create')

    await waitFor(async () => {
      const zoe = await db.players.where('name').equals('Zoe').first()
      expect(zoe).toBeDefined()
      expect(wrapper.emitted('created')?.[0]).toEqual([zoe!.id])
    })
  })

  it('open() resets the name field', async () => {
    const wrapper = await mountWithStubs(NewPlayerModal)

    await wrapper.get('input[type="text"]').setValue('Leftover')
    ;(wrapper.vm as unknown as { open: () => void }).open()
    await wrapper.vm.$nextTick()

    expect((wrapper.get('input[type="text"]').element as HTMLInputElement).value).toBe('')
  })

  it('submits on Enter the same as clicking Create', async () => {
    const wrapper = await mountWithStubs(NewPlayerModal)

    await wrapper.get('input[type="text"]').setValue('Enter Name')
    await wrapper.get('input[type="text"]').trigger('keyup.enter')

    await waitFor(async () => {
      expect(await db.players.where('name').equals('Enter Name').count()).toBe(1)
    })
  })
})
