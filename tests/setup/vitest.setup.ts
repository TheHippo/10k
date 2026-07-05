import 'fake-indexeddb/auto'
import { afterEach } from 'vitest'
import { resetDb } from './reset-db'

afterEach(async () => {
  await resetDb()
  localStorage.clear()
})
