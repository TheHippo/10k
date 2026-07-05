import { db } from '~/db'

export async function resetDb() {
  await db.delete()
  await db.open()
}
