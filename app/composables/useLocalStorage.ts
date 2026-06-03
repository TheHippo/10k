import { ref, watch } from 'vue'
import type { Ref } from 'vue'

export function useLocalStorage<T>(key: string, defaultValue: T): Ref<T> {
  const stored = localStorage.getItem(key)
  const value = ref<T>(stored !== null ? JSON.parse(stored) : defaultValue) as Ref<T>

  watch(value, (v) => {
    localStorage.setItem(key, JSON.stringify(v))
  })

  return value
}
