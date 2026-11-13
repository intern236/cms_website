import 'server-only'
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  max,
  ne,
  notInArray,
  or,
  sql,
  type ExtractTablesWithRelations,
  type SQL,
} from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from 'drizzle-orm/pg-core'
import type { PostListQuery, Scope, Store, System, WorkspaceStats } from '../store'
import type { Role } from '../types'
import { openDatabase } from './open'
import * as schema from './schema'

/**
 * THE POSTGRES ADAPTER (also PGlite). Implements lib/db/store.ts with Drizzle.
 *
 * Client isolation: `inWorkspace` opens a transaction, pins `app.workspace_id` and
 * switches to the restricted `cms_app` role, so Postgres row-level security hides
 * every other client's rows — even from a query that forgot its WHERE clause
 * (drizzle/0001_rls.sql). The WHERE clauses below are belt; RLS is braces.
 */

const {
  auditLog,
  authors,
  contactMessages,
  contactRate,
  invites,
  loginAttempts,
  loginChallenges,
  memberships,
  outbox,
  passwordResets,
  posts,
  sessions,
  siteKeys,
  users,
  webhookDeliveries,
  workspaceLogos,
  workspaces,
} = schema

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>
type Tx = PgTransaction<PgQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>
type Conn = Db | Tx

/** `%text%` for ILIKE, with the wildcards in the text escaped. */
function contains(text: string) {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
}

/** Drizzle returns `{ rows }` from node-postgres and PGlite alike. */
function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  return ((result as { rows?: T[] }).rows ?? []) as T[]
}

function live(now: Date): SQL {
  return and(eq(posts.status, 'published'), isNotNull(posts.publishedAt), lte(posts.publishedAt, now))!
}

// ---------------------------------------------------------------------------

function system(db: Db): System {
  return {
    users: {
      async count() {
        const [{ n }] = await db.select({ n: count() }).from(users)
        return n
      },
      async byId(id) {
        const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1)
        return row ?? null
      },
      async byEmail(email) {
        const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1)
        return row ?? null
      },
      async insert(user) {
        await db.insert(users).values({ ...user, isAgency: user.isAgency ?? false })
      },
      async update(id, patch) {
        if (Object.keys(patch).length) await db.update(users).set(patch).where(eq(users.id, id))
      },
      async delete(id) {
        await db.delete(users).where(eq(users.id, id))
      },
      agency() {
        return db.select().from(users).where(eq(users.isAgency, true)).orderBy(asc(users.name))
      },
      async countActiveAgency(exceptUserId) {
        const [{ n }] = await db
          .select({ n: count() })
          .from(users)
          .where(and(eq(users.isAgency, true), isNull(users.disabledAt), exceptUserId ? ne(users.id, exceptUserId) : undefined))
        return n
      },
    },

    workspaces: {
      async byId(id) {
        const [row] = await db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1)
        return row ?? null
      },
      async bySlug(slug) {
        const [row] = await db.select().from(workspaces).where(eq(workspaces.slug, slug)).limit(1)
        return row ?? null
      },
      list(options) {
        return db
          .select()
          .from(workspaces)
          .where(options?.includeArchived ? undefined : isNull(workspaces.archivedAt))
          .orderBy(asc(workspaces.name))
      },
      async byIds(ids) {
        if (!ids.length) return []
        return db
          .select()
          .from(workspaces)
          .where(and(inArray(workspaces.id, ids), isNull(workspaces.archivedAt)))
          .orderBy(asc(workspaces.name))
      },
      async insert(row) {
        const [created] = await db.insert(workspaces).values(row).returning()
        return created
      },
      async update(id, patch) {
        await db.update(workspaces).set(patch).where(eq(workspaces.id, id))
      },
      async setLogo(id, data, contentType) {
        const now = new Date()
        await db
          .insert(workspaceLogos)
          .values({ workspaceId: id, data, contentType, updatedAt: now })
          .onConflictDoUpdate({ target: workspaceLogos.workspaceId, set: { data, contentType, updatedAt: now } })
        await db.update(workspaces).set({ hasLogo: true, updatedAt: now }).where(eq(workspaces.id, id))
      },
      async removeLogo(id) {
        await db.delete(workspaceLogos).where(eq(workspaceLogos.workspaceId, id))
        await db.update(workspaces).set({ hasLogo: false, updatedAt: new Date() }).where(eq(workspaces.id, id))
      },
      async logoBySlug(slug) {
        const [row] = await db
          .select({ data: workspaceLogos.data, contentType: workspaceLogos.contentType, updatedAt: workspaceLogos.updatedAt })
          .from(workspaceLogos)
          .innerJoin(workspaces, eq(workspaces.id, workspaceLogos.workspaceId))
          .where(eq(workspaces.slug, slug))
          .limit(1)
        return row ?? null
      },
    },

    members: {
      async get(workspaceId, userId) {
        const [row] = await db
          .select()
          .from(memberships)
          .where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, userId)))
          .limit(1)
        return row ?? null
      },
      list(workspaceId) {
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
      },
      async ownerCount(workspaceId) {
        const [row] = await db
          .select({ n: count() })
          .from(memberships)
          .innerJoin(users, eq(users.id, memberships.userId))
          .where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.role, 'owner'), isNull(users.disabledAt)))
        return row.n
      },
      async setRole(workspaceId, userId, role) {
        await db
          .update(memberships)
          .set({ role })
          .where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, userId)))
      },
      async remove(workspaceId, userId) {
        await db.delete(memberships).where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, userId)))
      },
      async upsert(workspaceId, userId, role) {
        await upsertMembership(db, workspaceId, userId, role)
      },
      async workspacesOf(userId) {
        const rows = await db
          .select({ workspace: workspaces, role: memberships.role })
          .from(memberships)
          .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
          .where(and(eq(memberships.userId, userId), isNull(workspaces.archivedAt)))
          .orderBy(asc(workspaces.name))
        return rows.map((r) => ({ ...r.workspace, role: r.role }))
      },
    },

    invites: {
      async revokeOpen(email, workspaceId, at) {
        await db
          .update(invites)
          .set({ revokedAt: at })
          .where(
            and(
              eq(invites.email, email),
              workspaceId ? eq(invites.workspaceId, workspaceId) : isNull(invites.workspaceId),
              isNull(invites.acceptedAt),
              isNull(invites.revokedAt)
            )
          )
      },
      async insert(row) {
        await db.insert(invites).values(row)
      },
      async findOpen(tokenHash, now) {
        const [row] = await db
          .select()
          .from(invites)
          .where(and(eq(invites.tokenHash, tokenHash), isNull(invites.acceptedAt), isNull(invites.revokedAt), gt(invites.expiresAt, now)))
          .limit(1)
        return row ?? null
      },
      accept(invite, userId, at) {
        /* UPDATE … WHERE accepted_at IS NULL makes a double click or a replay a no-op. */
        return db.transaction(async (tx) => {
          const used = await tx
            .update(invites)
            .set({ acceptedAt: at })
            .where(and(eq(invites.id, invite.id), isNull(invites.acceptedAt), isNull(invites.revokedAt)))
            .returning({ id: invites.id })
          if (!used.length) return false
          if (invite.role === 'agency') {
            await tx.update(users).set({ isAgency: true }).where(eq(users.id, userId))
          } else if (invite.workspaceId) {
            await upsertMembership(tx, invite.workspaceId, userId, invite.role)
          }
          return true
        })
      },
      async revoke(workspaceId, id, at) {
        await db
          .update(invites)
          .set({ revokedAt: at })
          .where(and(eq(invites.id, id), workspaceId ? eq(invites.workspaceId, workspaceId) : isNull(invites.workspaceId)))
      },
      pending(workspaceId, now) {
        return db
          .select()
          .from(invites)
          .where(
            and(
              workspaceId ? eq(invites.workspaceId, workspaceId) : isNull(invites.workspaceId),
              isNull(invites.acceptedAt),
              isNull(invites.revokedAt),
              gt(invites.expiresAt, now)
            )
          )
          .orderBy(desc(invites.createdAt))
      },
    },

    sessions: {
      async insert(row) {
        await db.insert(sessions).values(row)
      },
      async findActive(id, now) {
        const [row] = await db
          .select({ session: sessions, user: users })
          .from(sessions)
          .innerJoin(users, eq(users.id, sessions.userId))
          .where(and(eq(sessions.id, id), gt(sessions.expiresAt, now)))
          .limit(1)
        if (!row) return null
        const ms = await db
          .select({ workspaceId: memberships.workspaceId, role: memberships.role })
          .from(memberships)
          .where(eq(memberships.userId, row.user.id))
        return { ...row, memberships: ms }
      },
      async touch(id, at) {
        await db.update(sessions).set({ lastSeenAt: at }).where(eq(sessions.id, id))
      },
      async delete(id) {
        await db.delete(sessions).where(eq(sessions.id, id))
      },
      async deleteForUser(userId, keepId) {
        await db
          .delete(sessions)
          .where(keepId ? and(eq(sessions.userId, userId), ne(sessions.id, keepId)) : eq(sessions.userId, userId))
      },
      async deleteExpired(now) {
        await db.delete(sessions).where(lt(sessions.expiresAt, now))
      },
      listForUser(userId, now) {
        return db
          .select()
          .from(sessions)
          .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, now)))
          .orderBy(asc(sessions.lastSeenAt))
      },
    },

    challenges: {
      async deleteForUser(userId) {
        await db.delete(loginChallenges).where(eq(loginChallenges.userId, userId))
      },
      async deleteExpired(now) {
        await db.delete(loginChallenges).where(lt(loginChallenges.expiresAt, now))
      },
      async insert(row) {
        await db.insert(loginChallenges).values(row)
      },
      async findActive(id, now) {
        const [row] = await db
          .select()
          .from(loginChallenges)
          .where(and(eq(loginChallenges.id, id), gt(loginChallenges.expiresAt, now)))
          .limit(1)
        return row ?? null
      },
      async delete(id) {
        await db.delete(loginChallenges).where(eq(loginChallenges.id, id))
      },
      async setAttempts(id, attempts) {
        await db.update(loginChallenges).set({ attempts }).where(eq(loginChallenges.id, id))
      },
    },

    resets: {
      async deleteExpired(now) {
        await db.delete(passwordResets).where(lt(passwordResets.expiresAt, now))
      },
      async insert(row) {
        await db.insert(passwordResets).values(row)
      },
      async findActive(tokenHash, now) {
        const [row] = await db
          .select({ userId: passwordResets.userId, email: users.email, name: users.name })
          .from(passwordResets)
          .innerJoin(users, eq(users.id, passwordResets.userId))
          .where(and(eq(passwordResets.tokenHash, tokenHash), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, now)))
          .limit(1)
        return row ?? null
      },
      async markUsed(tokenHash, at) {
        const used = await db
          .update(passwordResets)
          .set({ usedAt: at })
          .where(and(eq(passwordResets.tokenHash, tokenHash), isNull(passwordResets.usedAt)))
          .returning({ userId: passwordResets.userId })
        return used.length > 0
      },
      async deleteForUser(userId) {
        await db.delete(passwordResets).where(eq(passwordResets.userId, userId))
      },
    },

    attempts: {
      async deleteBefore(since) {
        await db.delete(loginAttempts).where(lt(loginAttempts.at, since))
      },
      async count(key, since) {
        const [{ n }] = await db
          .select({ n: count() })
          .from(loginAttempts)
          .where(and(eq(loginAttempts.key, key), gt(loginAttempts.at, since)))
        return n
      },
      async insert(keys, at) {
        if (keys.length) await db.insert(loginAttempts).values(keys.map((key) => ({ id: newRowId(), key, at })))
      },
      async deleteKeys(keys) {
        if (keys.length) await db.delete(loginAttempts).where(inArray(loginAttempts.key, keys))
      },
    },

    siteKeys: {
      async insert(row) {
        await db.insert(siteKeys).values(row)
      },
      list(workspaceId) {
        return db.select().from(siteKeys).where(eq(siteKeys.workspaceId, workspaceId)).orderBy(desc(siteKeys.createdAt))
      },
      async revoke(workspaceId, id, at) {
        const rows = await db
          .update(siteKeys)
          .set({ revokedAt: at })
          .where(and(eq(siteKeys.workspaceId, workspaceId), eq(siteKeys.id, id), isNull(siteKeys.revokedAt)))
          .returning({ id: siteKeys.id })
        return rows.length > 0
      },
      async findActiveByPrefix(prefix) {
        const [row] = await db
          .select({ key: siteKeys, slug: workspaces.slug, archivedAt: workspaces.archivedAt })
          .from(siteKeys)
          .innerJoin(workspaces, eq(workspaces.id, siteKeys.workspaceId))
          .where(and(eq(siteKeys.prefix, prefix), isNull(siteKeys.revokedAt)))
          .limit(1)
        return row ? { key: row.key, workspace: { slug: row.slug, archivedAt: row.archivedAt } } : null
      },
      async touch(id, at) {
        await db.update(siteKeys).set({ lastUsedAt: at }).where(eq(siteKeys.id, id))
      },
    },

    webhooks: {
      async record(row) {
        await db.insert(webhookDeliveries).values(row)
      },
      async deleteBefore(workspaceId, before) {
        await db.delete(webhookDeliveries).where(and(eq(webhookDeliveries.workspaceId, workspaceId), lt(webhookDeliveries.at, before)))
      },
      recent(workspaceId, limit) {
        return db
          .select()
          .from(webhookDeliveries)
          .where(eq(webhookDeliveries.workspaceId, workspaceId))
          .orderBy(desc(webhookDeliveries.at))
          .limit(limit)
      },
    },

    outbox: {
      async insert(row) {
        await db.insert(outbox).values(row)
      },
      async deleteBefore(before) {
        await db.delete(outbox).where(lt(outbox.createdAt, before))
      },
      latest(limit) {
        return db.select().from(outbox).orderBy(desc(outbox.createdAt)).limit(limit)
      },
    },

    overview: {
      async allStats(now) {
        /* Six grouped queries for every workspace at once. */
        const [m, pub, drafts, unread, keys, hooks] = await Promise.all([
          db.select({ ws: memberships.workspaceId, n: count() }).from(memberships).groupBy(memberships.workspaceId),
          db
            .select({ ws: posts.workspaceId, n: count(), last: max(posts.publishedAt) })
            .from(posts)
            .where(live(now))
            .groupBy(posts.workspaceId),
          db
            .select({ ws: posts.workspaceId, status: posts.status, n: count() })
            .from(posts)
            .where(inArray(posts.status, ['draft', 'review']))
            .groupBy(posts.workspaceId, posts.status),
          db
            .select({ ws: contactMessages.workspaceId, n: count() })
            .from(contactMessages)
            .where(and(eq(contactMessages.archived, false), isNull(contactMessages.readAt)))
            .groupBy(contactMessages.workspaceId),
          db.select({ ws: siteKeys.workspaceId, n: count() }).from(siteKeys).where(isNull(siteKeys.revokedAt)).groupBy(siteKeys.workspaceId),
          db
            .selectDistinctOn([webhookDeliveries.workspaceId], { ws: webhookDeliveries.workspaceId, ok: webhookDeliveries.ok, at: webhookDeliveries.at })
            .from(webhookDeliveries)
            .orderBy(webhookDeliveries.workspaceId, desc(webhookDeliveries.at)),
        ])
        const stats = new Map<string, WorkspaceStats>()
        const of = (id: string) => {
          let s = stats.get(id)
          if (!s) {
            s = { members: 0, published: 0, lastPublishedAt: null, drafts: 0, review: 0, unread: 0, keys: 0, lastWebhook: null }
            stats.set(id, s)
          }
          return s
        }
        for (const r of m) of(r.ws).members = r.n
        for (const r of pub) Object.assign(of(r.ws), { published: r.n, lastPublishedAt: r.last ? new Date(r.last as unknown as string) : null })
        for (const r of drafts) of(r.ws)[r.status === 'draft' ? 'drafts' : 'review'] = r.n
        for (const r of unread) of(r.ws).unread = r.n
        for (const r of keys) of(r.ws).keys = r.n
        for (const r of hooks) of(r.ws).lastWebhook = { ok: r.ok, at: r.at }
        return stats
      },
      async publishedBetween(since, now) {
        const rows = await db
          .select({ at: posts.publishedAt })
          .from(posts)
          .where(and(live(now), gt(posts.publishedAt, since)))
        return rows.map((r) => r.at!)
      },
    },
  }
}

async function upsertMembership(conn: Conn, workspaceId: string, userId: string, role: Role) {
  await conn
    .insert(memberships)
    .values({ workspaceId, userId, role })
    .onConflictDoUpdate({ target: [memberships.workspaceId, memberships.userId], set: { role } })
}

/** Only for rows nobody looks up by id (rate-limit counters). */
function newRowId() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('node:crypto') as typeof import('node:crypto')).randomBytes(12).toString('hex')
}

// ---------------------------------------------------------------------------

function scope(tx: Tx, workspaceId: string): Scope {
  const P = eq(posts.workspaceId, workspaceId)
  const A = eq(authors.workspaceId, workspaceId)
  const C = eq(contactMessages.workspaceId, workspaceId)

  function postListWhere(q: PostListQuery): SQL[] {
    const where: SQL[] = [P]
    if (q.createdBy) where.push(eq(posts.createdBy, q.createdBy))
    switch (q.status) {
      case 'draft':
        where.push(eq(posts.status, 'draft'))
        break
      case 'review':
        where.push(eq(posts.status, 'review'))
        break
      case 'scheduled':
        where.push(eq(posts.status, 'published'), gt(posts.publishedAt, q.now))
        break
      case 'published':
        where.push(live(q.now))
        break
    }
    const text = q.q?.trim().slice(0, 100)
    if (text) {
      const pattern = contains(text)
      where.push(or(ilike(posts.title, pattern), ilike(posts.slug, pattern), ilike(posts.category, pattern))!)
    }
    return where
  }

  return {
    workspaceId,

    posts: {
      list(q) {
        return tx
          .select()
          .from(posts)
          .where(and(...postListWhere(q)))
          .orderBy(desc(posts.updatedAt))
          .limit(q.limit)
      },
      async get(id) {
        const [row] = await tx.select().from(posts).where(and(P, eq(posts.id, id))).limit(1)
        return row ?? null
      },
      async byIds(ids) {
        if (!ids.length) return []
        return tx.select().from(posts).where(and(P, inArray(posts.id, ids)))
      },
      async slugTaken(slug, excludeId) {
        const [row] = await tx
          .select({ id: posts.id })
          .from(posts)
          .where(and(P, eq(posts.slug, slug), excludeId ? ne(posts.id, excludeId) : undefined))
          .limit(1)
        return Boolean(row)
      },
      async categories() {
        const rows = await tx
          .selectDistinct({ category: posts.category })
          .from(posts)
          .where(and(P, isNotNull(posts.category), ne(posts.category, '')))
        return rows.map((r) => r.category!)
      },
      async tags() {
        const rows = await tx.execute<{ tag: string }>(
          sql`select distinct jsonb_array_elements_text(${posts.tags}) as tag from ${posts} where ${posts.workspaceId} = ${workspaceId}`
        )
        return rowsOf<{ tag: string }>(rows).map((r) => r.tag)
      },
      async countByAuthor(authorId) {
        const [row] = await tx.select({ n: count() }).from(posts).where(and(P, eq(posts.authorId, authorId)))
        return row.n
      },
      async countsByAuthor() {
        const rows = await tx
          .select({ authorId: posts.authorId, n: count() })
          .from(posts)
          .where(and(P, isNotNull(posts.authorId)))
          .groupBy(posts.authorId)
        return Object.fromEntries(rows.map((r) => [r.authorId!, r.n]))
      },
      async counts(now) {
        /* One query, four counts. */
        const [row] = await tx
          .select({
            drafts: sql<number>`count(*) filter (where ${posts.status} = 'draft')`.mapWith(Number),
            review: sql<number>`count(*) filter (where ${posts.status} = 'review')`.mapWith(Number),
            scheduled: sql<number>`count(*) filter (where ${posts.status} = 'published' and ${posts.publishedAt} > ${now})`.mapWith(Number),
            published: sql<number>`count(*) filter (where ${posts.status} = 'published' and ${posts.publishedAt} <= ${now})`.mapWith(Number),
          })
          .from(posts)
          .where(P)
        return row
      },
      async nextScheduled(now) {
        const [row] = await tx
          .select({ id: posts.id, title: posts.title, publishedAt: posts.publishedAt })
          .from(posts)
          .where(and(P, eq(posts.status, 'published'), gt(posts.publishedAt, now)))
          .orderBy(asc(posts.publishedAt))
          .limit(1)
        return row ?? null
      },
      async liveDatesSince(now, since) {
        const rows = await tx
          .select({ at: posts.publishedAt })
          .from(posts)
          .where(and(P, live(now), gt(posts.publishedAt, since)))
        return rows.map((r) => r.at!)
      },
      recent(limit) {
        return tx.select().from(posts).where(P).orderBy(desc(posts.updatedAt)).limit(limit)
      },

      async live(q) {
        const where: SQL[] = [P, live(q.now)]
        if (q.tagSlug) where.push(sql`${posts.tagSlugs} @> ${JSON.stringify([q.tagSlug])}::jsonb`)
        if (q.authorId) where.push(eq(posts.authorId, q.authorId))
        const [{ n }] = await tx.select({ n: count() }).from(posts).where(and(...where))
        const rows = await tx
          .select()
          .from(posts)
          .where(and(...where))
          .orderBy(desc(posts.publishedAt), desc(posts.id))
          .limit(q.limit)
          .offset(q.offset)
        return { rows, total: n }
      },
      async liveBySlug(slug, now) {
        const [row] = await tx.select().from(posts).where(and(P, eq(posts.slug, slug), live(now))).limit(1)
        return row ?? null
      },
      liveRelated(now, excludeIds, tagSlugs, limit) {
        if (limit <= 0 || (tagSlugs && !tagSlugs.length)) return Promise.resolve([])
        return tx
          .select()
          .from(posts)
          .where(
            and(
              P,
              live(now),
              excludeIds.length ? notInArray(posts.id, excludeIds) : undefined,
              tagSlugs ? sql`${posts.tagSlugs} ?| array[${sql.join(tagSlugs.map((s) => sql`${s}`), sql`, `)}]::text[]` : undefined
            )
          )
          .orderBy(desc(posts.publishedAt))
          .limit(limit)
      },
      async liveTagLists(now) {
        const rows = await tx
          .select({ tags: posts.tags })
          .from(posts)
          .where(and(P, live(now)))
          .orderBy(desc(posts.publishedAt))
        return rows.map((r) => r.tags ?? [])
      },
      async liveIndex(now) {
        const rows = await tx
          .select({ slug: posts.slug, updatedAt: posts.updatedAt, publishedAt: posts.publishedAt })
          .from(posts)
          .where(and(P, live(now)))
          .orderBy(desc(posts.publishedAt))
        return rows.map((r) => ({ slug: r.slug, updatedAt: r.updatedAt, publishedAt: r.publishedAt! }))
      },
      async liveAuthorIds(now) {
        const rows = await tx
          .selectDistinct({ authorId: posts.authorId })
          .from(posts)
          .where(and(P, live(now), isNotNull(posts.authorId)))
        return rows.map((r) => r.authorId!)
      },

      async insert(id, createdBy, fields) {
        await tx.insert(posts).values({ ...fields, id, workspaceId, createdBy, createdAt: fields.updatedAt })
      },
      async update(id, fields) {
        await tx
          .update(posts)
          .set(fields)
          .where(and(P, eq(posts.id, id)))
      },
      async delete(id) {
        await tx.delete(posts).where(and(P, eq(posts.id, id)))
      },
      async unassignAuthor(authorId) {
        const rows = await tx
          .update(posts)
          .set({ authorId: null })
          .where(and(P, eq(posts.authorId, authorId)))
          .returning({ id: posts.id })
        return rows.length
      },
      imageCandidates(publicId, exceptId) {
        const like = contains(publicId)
        return tx
          .select({ coverImage: posts.coverImage, contentHtml: posts.contentHtml })
          .from(posts)
          .where(
            and(
              P,
              exceptId ? ne(posts.id, exceptId) : undefined,
              or(sql`${posts.coverImage}::text like ${like}`, sql`${posts.contentHtml} like ${like}`)
            )
          )
      },
    },

    authors: {
      list() {
        return tx.select().from(authors).where(A).orderBy(asc(authors.name))
      },
      async get(id) {
        const [row] = await tx.select().from(authors).where(and(A, eq(authors.id, id))).limit(1)
        return row ?? null
      },
      async bySlug(slug) {
        const [row] = await tx.select().from(authors).where(and(A, eq(authors.slug, slug))).limit(1)
        return row ?? null
      },
      async byIds(ids) {
        if (!ids.length) return []
        return tx.select().from(authors).where(and(A, inArray(authors.id, ids)))
      },
      async slugTaken(slug, excludeId) {
        const [row] = await tx
          .select({ id: authors.id })
          .from(authors)
          .where(and(A, eq(authors.slug, slug), excludeId ? ne(authors.id, excludeId) : undefined))
          .limit(1)
        return Boolean(row)
      },
      async insert(id, fields) {
        await tx.insert(authors).values({ ...fields, id, workspaceId, createdAt: fields.updatedAt })
      },
      async update(id, fields) {
        await tx
          .update(authors)
          .set(fields)
          .where(and(A, eq(authors.id, id)))
      },
      async delete(id) {
        await tx.delete(authors).where(and(A, eq(authors.id, id)))
      },
      async avatarCandidates(publicId) {
        const rows = await tx
          .select({ avatar: authors.avatar })
          .from(authors)
          .where(and(A, sql`${authors.avatar}::text like ${contains(publicId)}`))
        return rows.map((r) => r.avatar)
      },
    },

    contact: {
      async rateAllowed(visitorKey, limits, since, now) {
        const R = eq(contactRate.workspaceId, workspaceId)
        await tx.delete(contactRate).where(and(R, lt(contactRate.at, since)))
        const [visitor] = await tx
          .select({ n: count() })
          .from(contactRate)
          .where(and(R, eq(contactRate.key, visitorKey), gt(contactRate.at, since)))
        if (visitor.n >= limits.perVisitor) return false
        const [all] = await tx
          .select({ n: count() })
          .from(contactRate)
          .where(and(R, gt(contactRate.at, since)))
        if (all.n >= limits.perWorkspace) return false
        await tx.insert(contactRate).values({ id: newRowId(), workspaceId, key: visitorKey, at: now })
        return true
      },
      async insert(row) {
        const [created] = await tx
          .insert(contactMessages)
          .values({ ...row, workspaceId })
          .returning()
        return created
      },
      list(q) {
        const where: SQL[] = [C, eq(contactMessages.archived, q.archived)]
        if (q.unreadOnly) where.push(isNull(contactMessages.readAt))
        const text = q.q?.trim().slice(0, 100)
        if (text) {
          const pattern = contains(text)
          where.push(
            or(
              ilike(contactMessages.name, pattern),
              ilike(contactMessages.email, pattern),
              ilike(contactMessages.company, pattern),
              ilike(contactMessages.message, pattern)
            )!
          )
        }
        return tx
          .select()
          .from(contactMessages)
          .where(and(...where))
          .orderBy(desc(contactMessages.receivedAt))
          .limit(q.limit)
      },
      async get(id) {
        const [row] = await tx.select().from(contactMessages).where(and(C, eq(contactMessages.id, id))).limit(1)
        return row ?? null
      },
      async countUnread() {
        const [row] = await tx
          .select({ n: count() })
          .from(contactMessages)
          .where(and(C, eq(contactMessages.archived, false), isNull(contactMessages.readAt)))
        return row.n
      },
      async update(id, set) {
        const rows = await tx
          .update(contactMessages)
          .set(set)
          .where(and(C, eq(contactMessages.id, id)))
          .returning({ id: contactMessages.id })
        return rows.length > 0
      },
      async delete(id) {
        const rows = await tx
          .delete(contactMessages)
          .where(and(C, eq(contactMessages.id, id)))
          .returning({ id: contactMessages.id })
        return rows.length > 0
      },
      all() {
        return tx.select().from(contactMessages).where(C).orderBy(asc(contactMessages.receivedAt))
      },
    },

    audit: {
      async insert(row, purgeBefore) {
        await tx.insert(auditLog).values({ ...row, workspaceId })
        await tx.delete(auditLog).where(and(eq(auditLog.workspaceId, workspaceId), lt(auditLog.at, purgeBefore)))
      },
      recent(limit) {
        return tx.select().from(auditLog).where(eq(auditLog.workspaceId, workspaceId)).orderBy(desc(auditLog.at)).limit(limit)
      },
    },
  }
}

// ---------------------------------------------------------------------------

/** Postgres reports a unique violation as SQLSTATE 23505, sometimes wrapped in a cause. */
function isDuplicate(error: unknown): boolean {
  for (let e: unknown = error, depth = 0; e && depth < 4; e = (e as { cause?: unknown }).cause, depth++) {
    if ((e as { code?: unknown }).code === '23505') return true
  }
  return false
}

export function openPostgres(backend: 'postgres' | 'pglite', url: string): Store {
  const { db, ready, close } = openDatabase(backend, url)
  return {
    backend,
    ready,
    system: system(db),
    inWorkspace(workspaceId, fn) {
      return db.transaction(async (tx) => {
        await tx.execute(sql`select set_config('app.workspace_id', ${workspaceId}, true)`)
        await tx.execute(sql`set local role cms_app`)
        return fn(scope(tx as Tx, workspaceId))
      })
    },
    readWorkspace(workspaceId, fn) {
      /* Row-level security needs a transaction to pin the workspace; a read-only one refuses any write. */
      return db.transaction(async (tx) => {
        await tx.execute(sql`set transaction read only`)
        await tx.execute(sql`select set_config('app.workspace_id', ${workspaceId}, true)`)
        await tx.execute(sql`set local role cms_app`)
        return fn(scope(tx as Tx, workspaceId))
      })
    },
    isDuplicate,
    close,
  }
}
