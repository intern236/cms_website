import 'server-only'
import { count } from 'drizzle-orm'
import { sys } from '@/lib/db'
import { users } from '@/lib/db/schema'

export async function userCount(): Promise<number> {
  const db = await sys()
  const [{ n }] = await db.select({ n: count() }).from(users)
  return n
}
