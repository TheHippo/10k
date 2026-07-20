import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { vi } from 'vitest'

/** Anything we can search within: the page wrapper, or a scoped element like a <dialog>. */
type Searchable = Pick<VueWrapper<any>, 'findAll'>

function normalize(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

/**
 * Finds a button by its accessible name — visible text, or aria-label for icon-only
 * buttons. Prefers an exact match and throws when a name is ambiguous, so a test can
 * never silently act on the wrong button.
 */
export function getButton(root: Searchable, name: string) {
  const buttons = root.findAll('button')
  const nameOf = (b: (typeof buttons)[number]) =>
    normalize(b.text()) || normalize(b.attributes('aria-label') ?? '')

  const exact = buttons.filter(b => nameOf(b) === name)
  if (exact.length === 1) return exact[0]!
  if (exact.length > 1) throw new Error(`${exact.length} buttons named "${name}"; scope the query`)

  const partial = buttons.filter(b => nameOf(b).includes(name))
  if (partial.length === 1) return partial[0]!
  if (partial.length > 1) throw new Error(`${partial.length} buttons matching "${name}"; scope the query`)

  const available = buttons.map(b => `"${nameOf(b)}"`).join(', ')
  throw new Error(`no button named "${name}". Available: ${available || '(none)'}`)
}

export async function clickButton(root: Searchable, name: string) {
  await getButton(root, name).trigger('click')
  await flushPromises()
}

/** Scopes a query to one dialog, identified by text in its heading. */
export function dialogTitled(wrapper: VueWrapper<any>, title: string) {
  const dialog = wrapper.findAll('dialog').find(d => normalize(d.text()).includes(title))
  if (!dialog) throw new Error(`no dialog containing "${title}"`)
  return dialog
}

export async function click(wrapper: VueWrapper<any>, selector: string) {
  await wrapper.get(selector).trigger('click')
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
