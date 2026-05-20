import { ref, onUnmounted, type Ref } from 'vue'
import { liveQuery } from 'dexie'

export function useLiveQuery<T>(
  querier: () => T | Promise<T>,
  initialValue: T,
): Ref<T> {
  const result = ref<T>(initialValue) as Ref<T>

  const subscription = liveQuery(querier).subscribe({
    next: (value) => { result.value = value },
    error: (err) => { console.error('[useLiveQuery]', err) },
  })

  onUnmounted(() => subscription.unsubscribe())

  return result
}
