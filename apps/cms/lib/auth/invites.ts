import 'server-only'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { newId, sys } from '@/lib/db'
import { invites, memberships, users, workspaces, type Role } from '@/lib/db/schema'
import { cmsUrl } from '@/lib/env'
import { agencyBrand, sendMail, workspaceBrand, type MailResult } from '@/lib/mail'
import { inviteEmail } from '@/lib/mail/templates'
import { ROLE_LABEL } from '@/lib/permissions'
import { isEmail, normaliseEmail, randomToken, sha256 } from '@/lib/security'
import { toRef } from '@/lib/auth/access'

/**
 * INVITES are how anyone gets an account. There is no public sign-up.
 *
 * The emailed link carries 256 random bits; only the hash is stored. Clicking it
 * proves the person controls that inbox, which is what lets an invite create an
 * account. It works once, for 7 days, and a newer invite to the same address and
 * workspace replaces the older one.
 */

export const INVITE_DAYS = 7

export type InviteRole = Role | 'agency'

export async function createInvite(input: {
  workspaceId: string | null
  email: string
  role: InviteRole
  inviter: { id: string; name: string }
}): Promise<{ ok: true; url: string; mail: MailResult } | { ok: false; error: string }> {
  const email = normaliseEmail(input.email)
  if (!isEmail(email)) return { ok: false, error: 'That email address does not look right.' }
  if ((input.role === 'agency') !== (input.workspaceId === null)) return { ok: false, error: 'Invalid invite.' }

  const db = await sys()
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (existing && input.workspaceId) {
    const [m] = await db
      .select()
      .from(memberships)
      .where(and(eq(memberships.workspaceId, input.workspaceId), eq(memberships.userId, existing.id)))
      .limit(1)
    if (m) return { ok: false, error: `${email} is already in this workspace.` }
  }
  if (existing?.isAgency && input.role === 'agency') return { ok: false, error: `${email} is already on the agency team.` }

  /* One live invite per address per workspace. */
  await db
    .update(invites)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(invites.email, email),
        input.workspaceId ? eq(invites.workspaceId, input.workspaceId) : isNull(invites.workspaceId),
        isNull(invites.acceptedAt),
        isNull(invites.revokedAt)
      )
    )

  const token = randomToken()
  await db.insert(invites).values({
    id: newId(),
    workspaceId: input.workspaceId,
    email,
    role: input.role,
    tokenHash: sha256(token),
    invitedBy: input.inviter.id,
    expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000),
  })

  const url = `${cmsUrl()}/invite/${token}`
  let brand = agencyBrand()
  let workspaceName: string | null = null
  if (input.workspaceId) {
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, input.workspaceId)).limit(1)
    if (ws) {
      brand = workspaceBrand(ws)
      workspaceName = ws.name
    }
  }
  const mail = await sendMail({
    to: email,
    fromName: brand.name,
    email: inviteEmail({
      brand,
      inviterName: input.inviter.name,
      workspaceName,
      roleLabel: input.role === 'agency' ? 'agency admin' : ROLE_LABEL[input.role].toLowerCase(),
      url,
      expiresInDays: INVITE_DAYS,
    }),
  })
  return { ok: true, url, mail }
}

export type OpenInvite = {
  id: string
  email: string
  role: InviteRole
  workspace: ReturnType<typeof toRef> | null
  existingUserId: string | null
}

/** The invite behind a link, if it is still usable. */
export async function findInvite(token: unknown): Promise<OpenInvite | null> {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null
  const db = await sys()
  const [row] = await db
    .select()
    .from(invites)
    .where(
      and(eq(invites.tokenHash, sha256(token)), isNull(invites.acceptedAt), isNull(invites.revokedAt), gt(invites.expiresAt, new Date()))
    )
    .limit(1)
  if (!row) return null
  let workspace = null
  if (row.workspaceId) {
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, row.workspaceId)).limit(1)
    if (!ws || ws.archivedAt) return null
    workspace = toRef(ws)
  }
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, row.email)).limit(1)
  return { id: row.id, email: row.email, role: row.role as InviteRole, workspace, existingUserId: user?.id ?? null }
}

/**
 * Marks the invite used and grants what it promised to `userId`.
 * The UPDATE … WHERE accepted_at IS NULL makes a double click or a replay a no-op.
 */
export async function consumeInvite(invite: OpenInvite, userId: string): Promise<boolean> {
  const db = await sys()
  return db.transaction(async (tx) => {
    const used = await tx
      .update(invites)
      .set({ acceptedAt: new Date() })
      .where(and(eq(invites.id, invite.id), isNull(invites.acceptedAt), isNull(invites.revokedAt)))
      .returning({ id: invites.id })
    if (!used.length) return false
    if (invite.role === 'agency') {
      await tx.update(users).set({ isAgency: true }).where(eq(users.id, userId))
    } else if (invite.workspace) {
      await tx
        .insert(memberships)
        .values({ workspaceId: invite.workspace.id, userId, role: invite.role })
        .onConflictDoUpdate({ target: [memberships.workspaceId, memberships.userId], set: { role: invite.role } })
    }
    return true
  })
}

export async function revokeInvite(workspaceId: string | null, inviteId: string) {
  const db = await sys()
  await db
    .update(invites)
    .set({ revokedAt: new Date() })
    .where(and(eq(invites.id, inviteId), workspaceId ? eq(invites.workspaceId, workspaceId) : isNull(invites.workspaceId)))
}
