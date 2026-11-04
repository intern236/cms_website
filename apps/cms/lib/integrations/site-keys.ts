import 'server-only'
import { randomBytes } from 'node:crypto'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { newId, sys } from '@/lib/db'
import { siteKeys, workspaces } from '@/lib/db/schema'
import { safeEqual, sha256 } from '@/lib/security'

/**
 * SITE KEYS let a client's website read its own published content.
 *
 * Format: `cms_<10-char prefix>_<43-char secret>`. The prefix finds the row; the
 * whole key is compared by sha256 in constant time. Shown once at creation, never
 * again. Read-only, one workspace, revocable. Keep it server-side on the site
 * (an env var) — it must never reach a browser.
 */

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

function prefix(): string {
  const bytes = randomBytes(10)
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('')
}

export async function createSiteKey(workspaceId: string, label: string, createdBy: string): Promise<{ id: string; key: string }> {
  const p = prefix()
  const key = `cms_${p}_${randomBytes(32).toString('base64url')}`
  const id = newId()
  const db = await sys()
  await db.insert(siteKeys).values({ id, workspaceId, label: label.slice(0, 60) || 'Website', prefix: p, keyHash: sha256(key), createdBy })
  return { id, key }
}

export async function listSiteKeys(workspaceId: string) {
  const db = await sys()
  return db
    .select({
      id: siteKeys.id,
      label: siteKeys.label,
      prefix: siteKeys.prefix,
      createdAt: siteKeys.createdAt,
      lastUsedAt: siteKeys.lastUsedAt,
      revokedAt: siteKeys.revokedAt,
    })
    .from(siteKeys)
    .where(eq(siteKeys.workspaceId, workspaceId))
    .orderBy(desc(siteKeys.createdAt))
}

export async function revokeSiteKey(workspaceId: string, id: string): Promise<boolean> {
  const db = await sys()
  const rows = await db
    .update(siteKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(siteKeys.workspaceId, workspaceId), eq(siteKeys.id, id), isNull(siteKeys.revokedAt)))
    .returning({ id: siteKeys.id })
  return rows.length > 0
}

export type KeyedWorkspace = {
  workspaceId: string
  slug: string
  keyId: string
}

const KEY_PATTERN = /^cms_([a-z0-9]{10})_[A-Za-z0-9_-]{43}$/

/** The workspace a request's `Authorization: Bearer cms_…` belongs to, or null. */
export async function verifySiteKey(authorization: string | null): Promise<KeyedWorkspace | null> {
  const key = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1]
  const m = key?.match(KEY_PATTERN)
  if (!key || !m) return null
  const db = await sys()
  const [row] = await db
    .select({
      id: siteKeys.id,
      keyHash: siteKeys.keyHash,
      lastUsedAt: siteKeys.lastUsedAt,
      workspaceId: siteKeys.workspaceId,
      slug: workspaces.slug,
      archivedAt: workspaces.archivedAt,
    })
    .from(siteKeys)
    .innerJoin(workspaces, eq(workspaces.id, siteKeys.workspaceId))
    .where(and(eq(siteKeys.prefix, m[1]), isNull(siteKeys.revokedAt)))
    .limit(1)
  if (!row || row.archivedAt || !safeEqual(sha256(key), row.keyHash)) return null
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 10 * 60_000) {
    await db.update(siteKeys).set({ lastUsedAt: new Date() }).where(eq(siteKeys.id, row.id))
  }
  return { workspaceId: row.workspaceId, slug: row.slug, keyId: row.id }
}
