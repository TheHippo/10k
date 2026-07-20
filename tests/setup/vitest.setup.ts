import 'fake-indexeddb/auto'
import { afterEach, beforeEach } from 'vitest'
import { resetDb } from './reset-db'
import { unmountAll } from './mount'

// Unmount first so live queries and listeners stop before the database goes away.
afterEach(() => {
  unmountAll()
})

// beforeEach rather than only afterEach: a crashed test, or a file that seeds at module
// scope, would otherwise leak state into whatever runs next.
beforeEach(async () => {
  await resetDb()
  localStorage.clear()
})
