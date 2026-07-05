import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import type { Ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { db } from '~/db'
import type { Player } from '~/db'
import { useLiveQuery } from '~/composables/useLiveQuery'
import { mountWithStubs } from '../../setup/mount'
import { waitFor } from '../../setup/dom'

function makeHost(capture: (ref: Ref<Player[]>) => void) {
  return defineComponent({
    setup() {
      const result = useLiveQuery(() => db.players.toArray(), [] as Player[])
      capture(result)
      return { result }
    },
    template: '<div>{{ result.length }}</div>',
  })
}

describe('useLiveQuery', () => {
  it('reflects query results once the initial query resolves', async () => {
    await db.players.add({ name: 'Alice' } as Player)

    let ref!: Ref<Player[]>
    const wrapper = await mountWithStubs(makeHost(r => (ref = r)))

    await waitFor(() => expect(ref.value).toHaveLength(1))
    expect(wrapper.text()).toBe('1')
  })

  it('updates reactively when the underlying table changes', async () => {
    let ref!: Ref<Player[]>
    await mountWithStubs(makeHost(r => (ref = r)))
    await waitFor(() => expect(ref.value).toHaveLength(0))

    await db.players.add({ name: 'Bob' } as Player)

    await waitFor(() => expect(ref.value).toHaveLength(1))
  })

  it('unsubscribes on unmount and stops receiving updates', async () => {
    let ref!: Ref<Player[]>
    const wrapper = await mountWithStubs(makeHost(r => (ref = r)))
    await waitFor(() => expect(ref.value).toHaveLength(0))

    wrapper.unmount()
    await db.players.add({ name: 'Cara' } as Player)
    await flushPromises()
    await new Promise(resolve => setTimeout(resolve, 20))

    expect(ref.value).toHaveLength(0)
  })
})
