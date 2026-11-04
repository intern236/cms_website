import 'server-only'
import { and, asc, count, desc, eq, gt, isNull } from 'drizzle-orm'
import { sys } from '@/lib/db'
import { invites, memberships, users, type Role } from '@/lib/db/schema'

/** People in a workspace, and the rules that keep a workspace from losing its last owner. */

export type Member = {
  userId: string
  name: string
  email: string
  role: Role
  joinedAt: Date
  lastLoginAt: Date | null
  twoFactor: boolean
}

export async function listMembers(workspaceId: string): Promise<Member[]> {
  const db = await sys()
  return db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      role: memberships.role,
      joinedAt: memberships.createdAt,
      lastLoginAt: users.lastLoginAt,
      twoFactor: users.twoFactor,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.workspaceId, workspaceId), isNull(users.disabledAt)))
    .orderBy(asc(users.name))
}

export async function pendingInvites(workspaceId: string) {
  const db = await sys()
  return db
    .select({ id: invites.id, email: invites.email, role: invites.role, expiresAt: invites.expiresAt, createdAt: invites.createdAt })
    .from(invites)
    .where(
      and(
        eq(invites.workspaceId, workspaceId),
        isNull(invites.acceptedAt),
        isNull(invites.revokedAt),
        gt(invites.expiresAt, new Date())
      )
    )
    .orderBy(desc(invites.createdAt))
}

export async function getMembership(workspaceId: string, userId: string) {
  const db = await sys()
  const [row] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, userId)))
    .limit(1)
  return row ?? null
}

async function ownerCount(workspaceId: string): Promise<number> {
  const db = await sys()
  const [row] = await db
    .select({ n: count() })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.role, 'owner'), isNull(users.disabledAt)))
  return row.n
}

export async function changeRole(workspaceId: string, userId: string, role: Role): Promise<string | null> {
  const current = await getMembership(workspaceId, userId)
  if (!current) return 'That person is not in this workspace.'
  if (current.role === 'owner' && role !== 'owner' && (await ownerCount(workspaceId)) <= 1) {
    return 'A workspace needs at least one owner. Make someone else an owner first.'
  }
  const db = await sys()
  await db
    .update(memberships)
    .set({ role })
    .where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, userId)))
  return null
}

export async function removeMember(workspaceId: string, userId: string): Promise<string | null> {
  const current = await getMembership(workspaceId, userId)
  if (!current) return 'That person is not in this workspace.'
  if (current.role === 'owner' && (await ownerCount(workspaceId)) <= 1) {
    return 'You cannot remove the last owner. Make someone else an owner first.'
  }
  const db = await sys()
  await db.delete(memberships).where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, userId)))
  return null
}

export async function addMember(workspaceId: string, userId: string, role: Role) {
  const db = await sys()
  await db
    .insert(memberships)
    .values({ workspaceId, userId, role })
    .onConflictDoUpdate({ target: [memberships.workspaceId, memberships.userId], set: { role } })
}
