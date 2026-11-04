import 'server-only'
import { cache } from 'react'
import { and, eq, gt, lt, ne } from 'drizzle-orm'
import { cookies, headers } from 'next/headers'
import { sys } from '@/lib/db'
import { sessions, users } from '@/lib/db/schema'
import { randomToken, sha256 } from '@/lib/security'

/**
 * SESSIONS LIVE IN THE DATABASE.
 *
 * The cookie holds 256 random bits; the table holds only their sha256. So:
 * - signing out, "sign out everywhere", disabling a user or removing them all take
 *   effect on the very next request;
 * - a stolen database dump contains no usable cookies.
 *
 * A session lasts 30 days at most and ends after 7 idle days.
 */

export const SESSION_COOKIE = 'cms_session'
const ABSOLUTE_DAYS = 30
const IDLE_DAYS = 7
const TOUCH_EVERY_MS = 5 * 60_000

const DAY = 86_400_000

function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds,
  }
}

export async function createSession(userId: string): Promise<void> {
  const token = randomToken()
  const now = new Date()
  const ua = ((await headers()).get('user-agent') ?? '').slice(0, 300)
  const db = await sys()
  await db.insert(sessions).values({
    id: sha256(token),
    userId,
    userAgent: ua,
    createdAt: now,
    lastSeenAt: now,
    expiresAt: new Date(now.getTime() + ABSOLUTE_DAYS * DAY),
  })
  await db.update(users).set({ lastLoginAt: now }).where(eq(users.id, userId))
  ;(await cookies()).set(SESSION_COOKIE, token, cookieOptions(ABSOLUTE_DAYS * 86_400))
  /* Opportunistic cleanup, so the table never grows without bound. */
  await db.delete(sessions).where(lt(sessions.expiresAt, now))
}

export type SessionUser = {
  sessionId: string
  id: string
  email: string
  name: string
  isAgency: boolean
  twoFactor: boolean
}

/** The signed-in user for this request, or null. Memoised per request. */
export const currentSession = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token || token.length > 100) return null
  const id = sha256(token)
  const db = await sys()
  const now = new Date()
  const [row] = await db
    .select({
      sessionId: sessions.id,
      lastSeenAt: sessions.lastSeenAt,
      id: users.id,
      email: users.email,
      name: users.name,
      isAgency: users.isAgency,
      twoFactor: users.twoFactor,
      disabledAt: users.disabledAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, now)))
    .limit(1)
  if (!row || row.disabledAt) return null
  if (now.getTime() - row.lastSeenAt.getTime() > IDLE_DAYS * DAY) {
    await db.delete(sessions).where(eq(sessions.id, id))
    return null
  }
  if (now.getTime() - row.lastSeenAt.getTime() > TOUCH_EVERY_MS) {
    await db.update(sessions).set({ lastSeenAt: now }).where(eq(sessions.id, id))
  }
  return {
    sessionId: row.sessionId,
    id: row.id,
    email: row.email,
    name: row.name,
    isAgency: row.isAgency,
    twoFactor: row.twoFactor,
  }
})

export async function destroyCurrentSession(): Promise<void> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (token) {
    const db = await sys()
    await db.delete(sessions).where(eq(sessions.id, sha256(token)))
  }
  jar.set(SESSION_COOKIE, '', cookieOptions(0))
}

/** Ends every session a user has, optionally keeping one (the one doing the asking). */
export async function revokeSessions(userId: string, keepSessionId?: string): Promise<void> {
  const db = await sys()
  await db
    .delete(sessions)
    .where(keepSessionId ? and(eq(sessions.userId, userId), ne(sessions.id, keepSessionId)) : eq(sessions.userId, userId))
}

export async function listSessions(userId: string) {
  const db = await sys()
  return db
    .select({ id: sessions.id, userAgent: sessions.userAgent, createdAt: sessions.createdAt, lastSeenAt: sessions.lastSeenAt })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, new Date())))
    .orderBy(sessions.lastSeenAt)
}
