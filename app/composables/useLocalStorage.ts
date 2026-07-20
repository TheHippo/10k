import { ref, watch } from 'vue'
import type { Ref } from 'vue'

function read<T>(key: string, defaultValue: T): T {
  const stored = localStorage.getItem(key)
  if (stored === null) return defaultValue
  try {
    return JSON.parse(stored) as T
  } catch {
    // A corrupt value would otherwise throw during component setup and blank the page.
    localStorage.removeItem(key)
    return defaultValue
  }
}

export function useLocalStorage<T>(key: string, defaultValue: T): Ref<T> {
  const value = ref<T>(read(key, defaultValue)) as Ref<T>

  watch(value, (v) => {
    localStorage.setItem(key, JSON.stringify(v))
  })

  return value
}
