import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { useLocalStorage } from '~/composables/useLocalStorage'

describe('useLocalStorage', () => {
  it('returns the default value when no key exists', () => {
    const value = useLocalStorage('missing-key', 'fallback')
    expect(value.value).toBe('fallback')
  })

  it('hydrates from existing JSON in localStorage', () => {
    localStorage.setItem('existing-key', JSON.stringify({ a: 1 }))
    const value = useLocalStorage('existing-key', {} as { a?: number })
    expect(value.value).toEqual({ a: 1 })
  })

  it('persists JSON-serialized value to localStorage on change', async () => {
    const value = useLocalStorage('persist-key', 0)
    value.value = 42
    await nextTick()
    expect(localStorage.getItem('persist-key')).toBe('42')
  })
})
