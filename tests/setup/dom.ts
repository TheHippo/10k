import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { vi } from 'vitest'

export async function click(wrapper: VueWrapper<any>, selector: string) {
  await wrapper.get(selector).trigger('click')
  await flushPromises()
}

export function findButtonByText(wrapper: VueWrapper<any>, text: string) {
  const btn = wrapper.findAll('button').find(b => b.text().includes(text))
  if (!btn) throw new Error(`button with text "${text}" not found`)
  return btn
}

export async function clickButtonWithText(wrapper: VueWrapper<any>, text: string) {
  await findButtonByText(wrapper, text).trigger('click')
  await flushPromises()
}

export async function selectOptionWithText(select: { findAll: VueWrapper<any>['findAll'], setValue: VueWrapper<any>['setValue'] }, text: string) {
  const option = select.findAll('option').find((o: any) => o.text().includes(text))
  if (!option) throw new Error(`option with text "${text}" not found`)
  await select.setValue((option.element as HTMLOptionElement).value)
}

export async function waitFor(assertion: () => void | Promise<void>) {
  await vi.waitFor(assertion, { timeout: 1000, interval: 10 })
}
