import { mountSuspended } from '@nuxt/test-utils/runtime'

type MountArgs = Parameters<typeof mountSuspended>
type MountOptions = MountArgs[1]

export function mountWithStubs<T>(component: T, options: MountOptions = {}) {
  return mountSuspended(component, {
    ...options,
    global: {
      ...options?.global,
      stubs: {
        Icon: true,
        ...options?.global?.stubs,
      },
    },
  })
}
