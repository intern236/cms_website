import 'server-only'
import { randomInt } from 'node:crypto'
import { and, eq, gt, lt } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { sys } from '@/lib/db'
import { loginChallenges, users } from '@/lib/db/schema'
import { sendMail, type MailResult } from '@/lib/mail'
import { codeEmail, type Brand } from '@/lib/mail/templates'
import { hmac, randomToken, safeEqual, sha256 } from '@/lib/security'

/**
 * EMAILED SIGN-IN CODES.
 *
 * After a correct password, a user with 2FA on gets a 6-digit code by email and a
 * short-lived "pending" cookie. The code works once, for 10 minutes, and five wrong
 * tries burn the challenge. A new challenge replaces any older one for the user.
 */

export const PENDING_COOKIE = 'cms_pending'
export const CODE_MINUTES = 10
const MAX_TRIES = 5

function codeHash(challengeId: string, code: string) {
  return hmac(`${challengeId}:${code}`, '2fa')
}

export async function startChallenge(userId: string, email: string, brand: Brand): Promise<MailResult> {
  const token = randomToken()
  const id = sha256(token)
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const db = await sys()
  await db.delete(loginChallenges).where(eq(loginChallenges.userId, userId))
  await db.delete(loginChallenges).where(lt(loginChallenges.expiresAt, new Date()))
  await db.insert(loginChallenges).values({
    id,
    userId,
    codeHash: codeHash(id, code),
    expiresAt: new Date(Date.now() + CODE_MINUTES * 60_000),
  })
  ;(await cookies()).set(PENDING_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: CODE_MINUTES * 60,
  })
  return sendMail({ to: email, fromName: brand.name, email: codeEmail({ brand, code, minutes: CODE_MINUTES }) })
}

export type CodeResult = { status: 'ok'; userId: string } | { status: 'wrong' | 'expired' | 'locked' }

export async function verifyChallenge(code: string): Promise<CodeResult> {
  const jar = await cookies()
  const token = jar.get(PENDING_COOKIE)?.value
  if (!token || token.length > 100) return { status: 'expired' }
  const id = sha256(token)
  const db = await sys()
  const [row] = await db
    .select()
    .from(loginChallenges)
    .where(and(eq(loginChallenges.id, id), gt(loginChallenges.expiresAt, new Date())))
    .limit(1)
  if (!row) return { status: 'expired' }
  const cleaned = code.replace(/\s+/g, '')
  if (/^\d{6}$/.test(cleaned) && safeEqual(codeHash(id, cleaned), row.codeHash)) {
    await db.delete(loginChallenges).where(eq(loginChallenges.id, id))
    jar.set(PENDING_COOKIE, '', { path: '/', maxAge: 0 })
    const [user] = await db.select({ disabledAt: users.disabledAt }).from(users).where(eq(users.id, row.userId)).limit(1)
    if (!user || user.disabledAt) return { status: 'expired' }
    return { status: 'ok', userId: row.userId }
  }
  const tries = row.attempts + 1
  if (tries >= MAX_TRIES) {
    await db.delete(loginChallenges).where(eq(loginChallenges.id, id))
    jar.set(PENDING_COOKIE, '', { path: '/', maxAge: 0 })
    return { status: 'locked' }
  }
  await db.update(loginChallenges).set({ attempts: tries }).where(eq(loginChallenges.id, id))
  return { status: 'wrong' }
}

export async function pendingChallengeExists(): Promise<boolean> {
  const token = (await cookies()).get(PENDING_COOKIE)?.value
  if (!token || token.length > 100) return false
  const db = await sys()
  const [row] = await db
    .select({ id: loginChallenges.id })
    .from(loginChallenges)
    .where(and(eq(loginChallenges.id, sha256(token)), gt(loginChallenges.expiresAt, new Date())))
    .limit(1)
  return Boolean(row)
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return email
  const shown = local.length <= 2 ? local[0] : `${local[0]}${'•'.repeat(Math.min(6, local.length - 2))}${local.at(-1)}`
  return `${shown}@${domain}`
}
