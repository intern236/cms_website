import 'server-only'
import { and, asc, desc, eq, gt, isNull } from 'drizzle-orm'
import { sys } from '@/lib/db'
import { invites, users } from '@/lib/db/schema'

export async function agencyTeam() {
  const db = await sys()
  const members = await db
    .select({ id: users.id, name: users.name, email: users.email, lastLoginAt: users.lastLoginAt, twoFactor: users.twoFactor, disabledAt: users.disabledAt })
    .from(users)
    .where(eq(users.isAgency, true))
    .orderBy(asc(users.name))
  const pending = await db
    .select({ id: invites.id, email: invites.email, expiresAt: invites.expiresAt })
    .from(invites)
    .where(and(isNull(invites.workspaceId), isNull(invites.acceptedAt), isNull(invites.revokedAt), gt(invites.expiresAt, new Date())))
    .orderBy(desc(invites.createdAt))
  return { members, pending }
}
