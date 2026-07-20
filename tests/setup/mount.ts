import { mountSuspended } from '@nuxt/test-utils/runtime'

type MountArgs = Parameters<typeof mountSuspended>
type MountOptions = MountArgs[1]

const mounted: { unmount: () => void }[] = []

export async function mountWithStubs<T>(component: T, options: MountOptions = {}) {
  const wrapper = await mountSuspended(component, {
    ...options,
    global: {
      ...options?.global,
      stubs: {
        Icon: true,
        ...options?.global?.stubs,
      },
    },
  })
  mounted.push(wrapper)
  return wrapper
}

/**
 * Tears down everything mounted during a test. Without this, components stay alive for
 * the rest of the file: their Dexie live queries keep running against a database that
 * has since been reset, and their document-level listeners keep firing. Both produced
 * failures that only appeared when a spec ran alongside its neighbours.
 */
export function unmountAll() {
  while (mounted.length) {
    try {
      mounted.pop()!.unmount()
    } catch {
      // Already torn down by the test itself.
    }
  }
}
