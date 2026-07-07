import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import type { Ref } from 'vue'
import { useWakeLock } from '~/composables/useWakeLock'
import { mountWithStubs } from '../../setup/mount'
import { waitFor } from '../../setup/dom'

function makeHost(active: Ref<boolean>) {
  return defineComponent({
    setup() {
      const { isActive } = useWakeLock(active)
      return { isActive }
    },
    template: '<div>{{ isActive }}</div>',
  })
}

describe('useWakeLock', () => {
  let requestMock: ReturnType<typeof vi.fn>
  let releaseMock: ReturnType<typeof vi.fn>
  let releaseListeners: (() => void)[]

  beforeEach(() => {
    releaseListeners = []
    releaseMock = vi.fn(async () => {
      for (const cb of releaseListeners) cb()
    })
    const sentinel = {
      release: releaseMock,
      addEventListener: (event: string, cb: () => void) => {
        if (event === 'release') releaseListeners.push(cb)
      },
    }
    requestMock = vi.fn(async () => sentinel)
    vi.stubGlobal('navigator', { ...navigator, wakeLock: { request: requestMock } })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('requests a wake lock as soon as it is mounted active', async () => {
    const wrapper = await mountWithStubs(makeHost(ref(true)))

    await waitFor(() => expect(requestMock).toHaveBeenCalledWith('screen'))
    await waitFor(() => expect(wrapper.text()).toBe('true'))
  })

  it('does not request a wake lock while inactive', async () => {
    await mountWithStubs(makeHost(ref(false)))
    await new Promise(resolve => setTimeout(resolve, 20))

    expect(requestMock).not.toHaveBeenCalled()
  })

  it('requests a wake lock once active becomes true', async () => {
    const active = ref(false)
    await mountWithStubs(makeHost(active))

    active.value = true

    await waitFor(() => expect(requestMock).toHaveBeenCalledWith('screen'))
  })

  it('releases the wake lock once active becomes false', async () => {
    const active = ref(true)
    const wrapper = await mountWithStubs(makeHost(active))
    await waitFor(() => expect(requestMock).toHaveBeenCalled())

    active.value = false

    await waitFor(() => expect(releaseMock).toHaveBeenCalled())
    await waitFor(() => expect(wrapper.text()).toBe('false'))
  })

  it('releases the wake lock on unmount', async () => {
    const wrapper = await mountWithStubs(makeHost(ref(true)))
    await waitFor(() => expect(requestMock).toHaveBeenCalled())

    wrapper.unmount()

    await waitFor(() => expect(releaseMock).toHaveBeenCalled())
  })

  it('does nothing when the Wake Lock API is unavailable', async () => {
    const { wakeLock: _unused, ...navigatorWithoutWakeLock } = navigator as Navigator & { wakeLock?: unknown }
    vi.stubGlobal('navigator', navigatorWithoutWakeLock)

    await mountWithStubs(makeHost(ref(true)))
    await new Promise(resolve => setTimeout(resolve, 20))

    expect(requestMock).not.toHaveBeenCalled()
  })
})
