import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import PwaUpdatePrompt from '~/components/PwaUpdatePrompt.vue'
import PwaInstallPrompt from '~/components/PwaInstallPrompt.vue'
import { mountWithStubs } from '../setup/mount'
import { clickButton } from '../setup/dom'

const pwa = {
  needRefresh: false,
  showInstallPrompt: false,
  updateServiceWorker: vi.fn(),
  getSWRegistration: vi.fn(),
  install: vi.fn(),
  cancelInstall: vi.fn(),
}

mockNuxtImport('usePWA', () => () => pwa)

function fireVisibilityChange(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  vi.clearAllMocks()
  pwa.needRefresh = false
  pwa.showInstallPrompt = false
  fireVisibilityChange('visible')
})

describe('PwaUpdatePrompt', () => {
  it('stays hidden until an update is waiting', async () => {
    const wrapper = await mountWithStubs(PwaUpdatePrompt)
    expect(wrapper.text()).not.toContain('A new version is available')
  })

  it('offers a reload once an update is waiting', async () => {
    pwa.needRefresh = true
    const wrapper = await mountWithStubs(PwaUpdatePrompt)
    expect(wrapper.text()).toContain('A new version is available')
  })

  it('reloading applies the waiting service worker', async () => {
    pwa.needRefresh = true
    const wrapper = await mountWithStubs(PwaUpdatePrompt)

    await clickButton(wrapper, 'Reload')

    // `true` is what makes the new worker take over immediately rather than on next launch.
    expect(pwa.updateServiceWorker).toHaveBeenCalledWith(true)
  })

  it('checks for an update when the tab becomes visible again', async () => {
    const update = vi.fn()
    pwa.getSWRegistration.mockReturnValue({ update })
    await mountWithStubs(PwaUpdatePrompt)

    fireVisibilityChange('visible')

    expect(update).toHaveBeenCalled()
  })

  it('does not check while the tab is hidden', async () => {
    const update = vi.fn()
    pwa.getSWRegistration.mockReturnValue({ update })
    await mountWithStubs(PwaUpdatePrompt)

    fireVisibilityChange('hidden')

    expect(update).not.toHaveBeenCalled()
  })

  it('tolerates there being no service worker registration yet', async () => {
    pwa.getSWRegistration.mockReturnValue(undefined)
    await mountWithStubs(PwaUpdatePrompt)

    expect(() => fireVisibilityChange('visible')).not.toThrow()
  })

  it('removes its visibility listener on unmount', async () => {
    const update = vi.fn()
    pwa.getSWRegistration.mockReturnValue({ update })
    const wrapper = await mountWithStubs(PwaUpdatePrompt)

    wrapper.unmount()
    fireVisibilityChange('visible')

    // A leak here would be invisible in the app but keeps firing forever.
    expect(update).not.toHaveBeenCalled()
  })
})

describe('PwaInstallPrompt', () => {
  it('stays hidden until the browser offers an install', async () => {
    const wrapper = await mountWithStubs(PwaInstallPrompt)
    expect(wrapper.text()).not.toContain('Install this app')
  })

  it('prompts once the browser offers an install', async () => {
    pwa.showInstallPrompt = true
    const wrapper = await mountWithStubs(PwaInstallPrompt)
    expect(wrapper.text()).toContain('Install this app')
  })

  it('Install triggers the install flow', async () => {
    pwa.showInstallPrompt = true
    const wrapper = await mountWithStubs(PwaInstallPrompt)

    await clickButton(wrapper, 'Install')

    expect(pwa.install).toHaveBeenCalled()
    expect(pwa.cancelInstall).not.toHaveBeenCalled()
  })

  it('Dismiss cancels instead of installing', async () => {
    pwa.showInstallPrompt = true
    const wrapper = await mountWithStubs(PwaInstallPrompt)

    await clickButton(wrapper, 'Dismiss')

    expect(pwa.cancelInstall).toHaveBeenCalled()
    expect(pwa.install).not.toHaveBeenCalled()
  })
})
