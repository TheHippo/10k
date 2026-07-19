import { ref, watch, onUnmounted, type Ref } from 'vue'

export function useWakeLock(active: Ref<boolean>) {
  const isActive = ref(false)
  let sentinel: WakeLockSentinel | null = null

  async function acquire() {
    if (!('wakeLock' in navigator)) return
    try {
      sentinel = await navigator.wakeLock.request('screen')
      isActive.value = true
      sentinel.addEventListener('release', () => {
        isActive.value = false
      })
    } catch (err) {
      console.error('[useWakeLock]', err)
    }
  }

  async function release() {
    const current = sentinel
    sentinel = null
    await current?.release()
  }

  watch(active, (value) => {
    if (value) acquire()
    else release()
  }, { immediate: true })

  // The browser drops the lock when the tab is hidden, so re-acquire on return.
  useVisibilityChange(() => {
    if (active.value && !sentinel) acquire()
  })

  onUnmounted(release)

  return { isActive }
}
