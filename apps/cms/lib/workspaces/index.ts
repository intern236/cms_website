import 'server-only'
import { and, asc, count, desc, eq, gt, isNull, lte, max, sql } from 'drizzle-orm'
import { newId, sys } from '@/lib/db'
import {
  contactMessages,
  memberships,
  posts,
  siteKeys,
  webhookDeliveries,
  workspaceLogos,
  workspaces,
} from '@/lib/db/schema'
import { randomToken } from '@/lib/security'
import { toRef, type WorkspaceRef } from '@/lib/auth/access'
import { isHexColour, settingsSchema, workspaceSlugProblem, type WorkspaceSettings } from './settings'

/**
 * Workspaces (one per client): create, brand, configure. System-level — callers
 * have already checked the user may do this (lib/auth/access.ts).
 */

export async function createWorkspace(input: {
  name: string
  slug: string
  siteUrl: string
  accent: string
  settings?: Partial<WorkspaceSettings>
}): Promise<{ ok: true; workspace: WorkspaceRef } | { ok: false; errors: Record<string, string> }> {
  const errors: Record<string, string> = {}
  const name = input.name.trim()
  const slug = input.slug.trim().toLowerCase()
  if (!name || name.length > 80) errors.name = 'Give the client a name (up to 80 characters).'
  const slugProblem = workspaceSlugProblem(slug)
  if (slugProblem) errors.slug = slugProblem
  const siteUrl = normaliseSiteUrl(input.siteUrl)
  if (input.siteUrl.trim() && !siteUrl) errors.siteUrl = 'Enter the full address, like https://acme.com'
  if (!isHexColour(input.accent)) errors.accent = 'Pick a colour.'
  if (Object.keys(errors).length) return { ok: false, errors }

  const db = await sys()
  const [taken] = await db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.slug, slug)).limit(1)
  if (taken) return { ok: false, errors: { slug: 'Another client already uses that address.' } }

  const settings = settingsSchema.parse({ ...(input.settings ?? {}) })
  const [row] = await db
    .insert(workspaces)
    .values({
      id: newId(),
      slug,
      name,
      siteUrl: siteUrl ?? '',
      accent: input.accent.toLowerCase(),
      settings,
      webhookSecret: randomToken(32),
    })
    .returning()
  return { ok: true, workspace: toRef(row) }
}

/** https://acme.com/ → https://acme.com. Null if it is not an http(s) URL. */
export function normaliseSiteUrl(value: string): string | null {
  const raw = value.trim()
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    if (url.username || url.password) return null
    return `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, '')}`
  } catch {
    return null
  }
}

export async function updateSettings(workspaceId: string, settings: WorkspaceSettings) {
  const db = await sys()
  await db.update(workspaces).set({ settings, updatedAt: new Date() }).where(eq(workspaces.id, workspaceId))
}

export async function updateBranding(workspaceId: string, input: { name: string; accent: string }) {
  const db = await sys()
  await db
    .update(workspaces)
    .set({ name: input.name, accent: input.accent.toLowerCase(), updatedAt: new Date() })
    .where(eq(workspaces.id, workspaceId))
}

export async function updateIntegration(workspaceId: string, input: { siteUrl: string; webhookUrl: string }) {
  const db = await sys()
  await db
    .update(workspaces)
    .set({ siteUrl: input.siteUrl, webhookUrl: input.webhookUrl, updatedAt: new Date() })
    .where(eq(workspaces.id, workspaceId))
}

export async function rotateWebhookSecret(workspaceId: string): Promise<string> {
  const secret = randomToken(32)
  const db = await sys()
  await db.update(workspaces).set({ webhookSecret: secret, updatedAt: new Date() }).where(eq(workspaces.id, workspaceId))
  return secret
}

export async function getWebhookConfig(workspaceId: string) {
  const db = await sys()
  const [row] = await db
    .select({ url: workspaces.webhookUrl, secret: workspaces.webhookSecret, slug: workspaces.slug })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1)
  return row ?? null
}

export async function setArchived(workspaceId: string, archived: boolean) {
  const db = await sys()
  await db
    .update(workspaces)
    .set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
    .where(eq(workspaces.id, workspaceId))
}

// ---- Logo -------------------------------------------------------------------

export const LOGO_MAX_BYTES = 256 * 1024
export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'] as const

/** Checks the bytes, not just the declared type. */
export function sniffLogo(data: Buffer): (typeof LOGO_TYPES)[number] | null {
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg'
  if (data.length >= 12 && data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP') return 'image/webp'
  const head = data.subarray(0, 512).toString('utf8').trimStart().toLowerCase()
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) return 'image/svg+xml'
  return null
}

export async function setLogo(workspaceId: string, data: Buffer, contentType: string) {
  const db = await sys()
  await db
    .insert(workspaceLogos)
    .values({ workspaceId, data, contentType })
    .onConflictDoUpdate({ target: workspaceLogos.workspaceId, set: { data, contentType, updatedAt: new Date() } })
  await db.update(workspaces).set({ hasLogo: true, updatedAt: new Date() }).where(eq(workspaces.id, workspaceId))
}

export async function removeLogo(workspaceId: string) {
  const db = await sys()
  await db.delete(workspaceLogos).where(eq(workspaceLogos.workspaceId, workspaceId))
  await db.update(workspaces).set({ hasLogo: false, updatedAt: new Date() }).where(eq(workspaces.id, workspaceId))
}

export async function getLogo(slug: string) {
  const db = await sys()
  const [row] = await db
    .select({ data: workspaceLogos.data, contentType: workspaceLogos.contentType, updatedAt: workspaceLogos.updatedAt })
    .from(workspaceLogos)
    .innerJoin(workspaces, eq(workspaces.id, workspaceLogos.workspaceId))
    .where(eq(workspaces.slug, slug))
    .limit(1)
  return row ?? null
}

// ---- Agency overview ---------------------------------------------------------

export type WorkspaceOverview = WorkspaceRef & {
  members: number
  published: number
  drafts: number
  review: number
  unread: number
  lastPublishedAt: Date | null
  keys: number
  lastWebhook: { ok: boolean; at: Date } | null
}

/** Every client with the numbers the agency dashboard shows. Agency-only. */
export async function agencyOverview(includeArchived = false): Promise<WorkspaceOverview[]> {
  const db = await sys()
  const now = new Date()
  const rows = await db
    .select()
    .from(workspaces)
    .where(includeArchived ? undefined : isNull(workspaces.archivedAt))
    .orderBy(asc(workspaces.name))
  const result: WorkspaceOverview[] = []
  for (const row of rows) {
    const ws = eq(posts.workspaceId, row.id)
    const [[m], [pub], [drafts], [review], [unread], [keys], [deliv]] = await Promise.all([
      db.select({ n: count() }).from(memberships).where(eq(memberships.workspaceId, row.id)),
      db
        .select({ n: count(), last: max(posts.publishedAt) })
        .from(posts)
        .where(and(ws, eq(posts.status, 'published'), lte(posts.publishedAt, now))),
      db.select({ n: count() }).from(posts).where(and(ws, eq(posts.status, 'draft'))),
      db.select({ n: count() }).from(posts).where(and(ws, eq(posts.status, 'review'))),
      db
        .select({ n: count() })
        .from(contactMessages)
        .where(and(eq(contactMessages.workspaceId, row.id), eq(contactMessages.archived, false), isNull(contactMessages.readAt))),
      db.select({ n: count() }).from(siteKeys).where(and(eq(siteKeys.workspaceId, row.id), isNull(siteKeys.revokedAt))),
      db
        .select({ ok: webhookDeliveries.ok, at: webhookDeliveries.at })
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.workspaceId, row.id))
        .orderBy(desc(webhookDeliveries.at))
        .limit(1),
    ])
    result.push({
      ...toRef(row),
      members: m.n,
      published: pub.n,
      lastPublishedAt: pub.last ? new Date(pub.last as unknown as string) : null,
      drafts: drafts.n,
      review: review.n,
      unread: unread.n,
      keys: keys.n,
      lastWebhook: deliv ? { ok: deliv.ok, at: deliv.at } : null,
    })
  }
  return result
}

/** Posts that went live across every client in the last N days — for the agency chart. */
export async function agencyPublishing(days = 30): Promise<{ day: string; count: number }[]> {
  const db = await sys()
  const now = new Date()
  const since = new Date(now.getTime() - days * 86_400_000)
  const rows = await db
    .select({ day: sql<string>`to_char(${posts.publishedAt} at time zone 'UTC', 'YYYY-MM-DD')`, n: count() })
    .from(posts)
    .where(and(eq(posts.status, 'published'), gt(posts.publishedAt, since), lte(posts.publishedAt, now)))
    .groupBy(sql`1`)
  const map = new Map(rows.map((r) => [r.day, r.n]))
  const out: { day: string; count: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const key = new Date(now.getTime() - i * 86_400_000).toISOString().slice(0, 10)
    out.push({ day: key, count: map.get(key) ?? 0 })
  }
  return out
}
