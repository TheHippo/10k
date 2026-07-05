import { describe, expect, it } from 'vitest'
import AppCard from '~/components/AppCard.vue'
import { mountWithStubs } from '../setup/mount'

describe('AppCard', () => {
  it('applies the default shadow class and renders slot content', async () => {
    const wrapper = await mountWithStubs(AppCard, {
      slots: { default: '<p>hello</p>' },
    })

    expect(wrapper.find('.card').classes()).toContain('shadow')
    expect(wrapper.text()).toContain('hello')
  })

  it('applies a custom shadow class and compact padding', async () => {
    const wrapper = await mountWithStubs(AppCard, {
      props: { shadow: 'shadow-sm', compact: true },
      slots: { default: '<p>hello</p>' },
    })

    expect(wrapper.find('.card').classes()).toContain('shadow-sm')
    expect(wrapper.find('.card').classes()).not.toContain('shadow')
    expect(wrapper.find('.card-body').classes()).toContain('py-4')
  })
})
