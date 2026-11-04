import 'server-only'
import { and, count, eq, gt, inArray, lt } from 'drizzle-orm'
import { newId, sys } from '@/lib/db'
import { loginAttempts } from '@/lib/db/schema'
import { hmac } from '@/lib/security'

/**
 * Failed sign-in limits, in three layers:
 *
 * - per IP:      5 failures / 15 min (stops one machine guessing)
 * - per account: 10 failures / 15 min (stops a botnet focusing on one person)
 * - everywhere:  100 failures / 15 min (stops a botnet spraying many accounts)
 *
 * Only failures count, and a successful sign-in clears that IP's and account's.
 * The same limiter guards the 2FA code, password reset and invite pages.
 */

const WINDOW_MS = 15 * 60_000
export const LIMITS = { ip: 5, account: 10, global: 100 }

const keyFor = {
  ip: (ipKey: string) => `ip:${ipKey}`,
  account: (email: string) => `acct:${hmac(email, 'acct').slice(0, 32)}`,
  global: () => 'global',
}

export async function attemptsAllowed(ipKey: string, email?: string): Promise<boolean> {
  const db = await sys()
  const since = new Date(Date.now() - WINDOW_MS)
  await db.delete(loginAttempts).where(lt(loginAttempts.at, since))
  const counts = async (key: string) =>
    (await db.select({ n: count() }).from(loginAttempts).where(and(eq(loginAttempts.key, key), gt(loginAttempts.at, since))))[0]
      .n
  if ((await counts(keyFor.ip(ipKey))) >= LIMITS.ip) return false
  if (email && (await counts(keyFor.account(email))) >= LIMITS.account) return false
  if ((await counts(keyFor.global())) >= LIMITS.global) return false
  return true
}

export async function recordFailure(ipKey: string, email?: string): Promise<void> {
  const db = await sys()
  const rows = [keyFor.ip(ipKey), keyFor.global(), ...(email ? [keyFor.account(email)] : [])].map((key) => ({
    id: newId(),
    key,
  }))
  await db.insert(loginAttempts).values(rows)
}

export async function clearFailures(ipKey: string, email?: string): Promise<void> {
  const db = await sys()
  const keys = [keyFor.ip(ipKey), ...(email ? [keyFor.account(email)] : [])]
  await db.delete(loginAttempts).where(inArray(loginAttempts.key, keys))
}

/**
 * A simple counter for anything else worth throttling (reset emails, invite
 * accepts): allows `limit` events per key per 15 minutes, and records this one.
 */
export async function throttle(key: string, limit: number): Promise<boolean> {
  const db = await sys()
  const since = new Date(Date.now() - WINDOW_MS)
  const full = `t:${key}`
  const [{ n }] = await db
    .select({ n: count() })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.key, full), gt(loginAttempts.at, since)))
  if (n >= limit) return false
  await db.insert(loginAttempts).values({ id: newId(), key: full })
  return true
}
