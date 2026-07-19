import { describe, expect, it } from 'vitest'
import App from '~/app.vue'
import { mountWithStubs } from './setup/mount'

describe('app.vue shell', () => {
  it('offers the three top-level destinations', async () => {
    const wrapper = await mountWithStubs(App)

    const links = wrapper.findAll('.menu a')
    expect(links.map(a => a.text())).toEqual(['Game', 'History', 'Players'])
    expect(links.map(a => a.attributes('href'))).toEqual(['/', '/history', '/players'])
  })

  it('marks the current route as active and no other', async () => {
    const wrapper = await mountWithStubs(App)

    const active = wrapper.findAll('.menu a').filter(a => a.classes().includes('menu-active'))
    expect(active).toHaveLength(1)
    expect(active[0]!.attributes('href')).toBe('/')
  })

  it('closing the drawer unchecks the toggle', async () => {
    const wrapper = await mountWithStubs(App)

    const toggle = wrapper.get<HTMLInputElement>('#nav-drawer')
    await toggle.setValue(true)
    expect(toggle.element.checked).toBe(true)

    // Following a nav link closes the drawer on small screens.
    await wrapper.findAll('.menu a')[1]!.trigger('click')

    expect(toggle.element.checked).toBe(false)
  })

  it('labels the sidebar controls for screen readers', async () => {
    const wrapper = await mountWithStubs(App)

    expect(wrapper.get('label[for="nav-drawer"][aria-label="open sidebar"]').exists()).toBe(true)
    expect(wrapper.get('.drawer-overlay').attributes('aria-label')).toBe('close sidebar')
  })

  it('mounts the PWA manifest and both prompts', async () => {
    const wrapper = await mountWithStubs(App)

    expect(wrapper.findComponent({ name: 'PwaUpdatePrompt' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'PwaInstallPrompt' }).exists()).toBe(true)
  })
})
