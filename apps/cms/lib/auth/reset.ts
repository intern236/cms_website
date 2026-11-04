import 'server-only'
import { and, eq, gt, isNull, lt } from 'drizzle-orm'
import { sys } from '@/lib/db'
import { passwordResets, users } from '@/lib/db/schema'
import { cmsUrl } from '@/lib/env'
import { agencyBrand, sendMail, workspaceBrand } from '@/lib/mail'
import { resetEmail } from '@/lib/mail/templates'
import { normaliseEmail, randomToken, sha256 } from '@/lib/security'
import { hashPassword } from './password'
import { revokeSessions } from './session'

/**
 * PASSWORD RESET.
 *
 * The request always answers the same way whether or not the address has an
 * account, so it cannot be used to find out who is a user. The link works once,
 * for 30 minutes; using it signs the account out everywhere.
 */

export const RESET_MINUTES = 30

export async function requestReset(rawEmail: string, brandFor?: { name: string; accent: string; hasLogo: boolean; slug: string }) {
  const email = normaliseEmail(rawEmail)
  const db = await sys()
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (!user || user.disabledAt) return
  await db.delete(passwordResets).where(lt(passwordResets.expiresAt, new Date()))
  const token = randomToken()
  await db.insert(passwordResets).values({
    tokenHash: sha256(token),
    userId: user.id,
    expiresAt: new Date(Date.now() + RESET_MINUTES * 60_000),
  })
  const brand = brandFor ? workspaceBrand(brandFor) : agencyBrand()
  await sendMail({
    to: { name: user.name, address: user.email },
    fromName: brand.name,
    email: resetEmail({ brand, name: user.name, url: `${cmsUrl()}/reset/${token}`, minutes: RESET_MINUTES }),
  })
}

export async function findReset(token: unknown) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null
  const db = await sys()
  const [row] = await db
    .select({ userId: passwordResets.userId, email: users.email, name: users.name })
    .from(passwordResets)
    .innerJoin(users, eq(users.id, passwordResets.userId))
    .where(and(eq(passwordResets.tokenHash, sha256(token)), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, new Date())))
    .limit(1)
  return row ?? null
}

/** Sets the new password if the token is still good. Returns the user id, or null. */
export async function completeReset(token: string, password: string): Promise<string | null> {
  const found = await findReset(token)
  if (!found) return null
  const db = await sys()
  const used = await db
    .update(passwordResets)
    .set({ usedAt: new Date() })
    .where(and(eq(passwordResets.tokenHash, sha256(token)), isNull(passwordResets.usedAt)))
    .returning({ userId: passwordResets.userId })
  if (!used.length) return null
  await db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, found.userId))
  await db.delete(passwordResets).where(eq(passwordResets.userId, found.userId))
  await revokeSessions(found.userId)
  return found.userId
}
