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

  async function handleVisibilityChange() {
    if (active.value && document.visibilityState === 'visible' && !sentinel) {
      await acquire()
    }
  }

  watch(active, (value) => {
    if (value) acquire()
    else release()
  }, { immediate: true })

  document.addEventListener('visibilitychange', handleVisibilityChange)

  onUnmounted(() => {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    release()
  })

  return { isActive }
}
