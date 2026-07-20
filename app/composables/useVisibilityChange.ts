import { onUnmounted } from 'vue'

/**
 * Runs `onVisible` whenever the tab becomes visible again, and removes the listener on
 * unmount. Used by the wake lock (re-acquire) and the PWA prompt (check for updates).
 *
 * Registers during setup rather than on mount, so a visibility change that lands between
 * setup and mount is not missed.
 */
export function useVisibilityChange(onVisible: () => void) {
  function handler() {
    if (document.visibilityState === 'visible') onVisible()
  }

  document.addEventListener('visibilitychange', handler)
  onUnmounted(() => document.removeEventListener('visibilitychange', handler))
}
