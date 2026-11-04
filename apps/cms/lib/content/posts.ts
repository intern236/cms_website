import 'server-only'
import { and, asc, count, desc, eq, gt, ilike, inArray, isNotNull, lte, ne, or, sql, type SQL } from 'drizzle-orm'
import type { Tx } from '@/lib/db'
import { newId } from '@/lib/db'
import { posts, type PostFormat, type PostStatus, type StoredImage } from '@/lib/db/schema'
import { decodeHtmlEntities } from '@/lib/content/html-entities'
import { slugify } from '@/lib/slug'

/**
 * Posts: every read and write. Each function takes the `tx` handed out by
 * inWorkspace(), so it can only ever see the one workspace that transaction is
 * pinned to — the WHERE clauses below are belt, row-level security is braces.
 *
 * SCHEDULING is not a stored status: a scheduled post is `published` with a future
 * `publishedAt`. Every public query asks for `publishedAt <= now`, so it starts
 * matching on its own when the time comes. No cron job.
 */

export type DisplayStatus = 'draft' | 'review' | 'scheduled' | 'published'

export interface Post {
  id: string
  workspaceId: string
  slug: string
  title: string
  description: string
  excerpt: string | null
  format: PostFormat
  contentHtml: string
  coverImage: StoredImage | null
  coverAlt: string | null
  coverCaption: string | null
  category: string | null
  tags: string[]
  faqs: { question: string; answer: string }[]
  authorId: string | null
  seoTitle: string | null
  focusKeyword: string | null
  status: PostStatus
  publishedAt: Date | null
  readingMinutes: number
  createdBy: string | null
  updatedBy: string | null
  createdAt: Date
  updatedAt: Date
}

export const POST_LIMITS = {
  title: 160,
  slug: 96,
  description: 320,
  excerpt: 400,
  category: 60,
  tag: 40,
  tagCount: 12,
  faqQuestion: 200,
  faqAnswer: 900,
  faqCount: 12,
  seoTitle: 80,
  focusKeyword: 60,
  coverAlt: 125,
  coverCaption: 125,
  contentHtml: 400_000,
} as const

/** Slugs the blog's own routes own: /blog/tag/…, /blog/page/2. */
export const RESERVED_POST_SLUGS = new Set(['tag', 'page', 'feed', 'rss', 'preview'])

export function displayStatus(post: Pick<Post, 'status' | 'publishedAt'>, now = new Date()): DisplayStatus {
  if (post.status === 'published' && post.publishedAt && post.publishedAt > now) return 'scheduled'
  return post.status
}

/** True once the post has been visible to the public at some point. */
export function hasGoneLive(post: Pick<Post, 'publishedAt'>, now = new Date()): boolean {
  return Boolean(post.publishedAt && post.publishedAt <= now)
}

export function tagSlug(tag: string): string {
  return slugify(tag)
}

function live(now: Date): SQL {
  return and(eq(posts.status, 'published'), isNotNull(posts.publishedAt), lte(posts.publishedAt, now))!
}

type Row = typeof posts.$inferSelect

function toFaqs(value: unknown): { question: string; answer: string }[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const raw = entry as Record<string, unknown>
    const question = typeof raw.question === 'string' ? decodeHtmlEntities(raw.question).trim() : ''
    const answer = typeof raw.answer === 'string' ? decodeHtmlEntities(raw.answer).trim() : ''
    return question && answer ? [{ question, answer }] : []
  })
}

export function toPost(row: Row): Post {
  const cover = row.coverImage && typeof row.coverImage.publicId === 'string' && row.coverImage.publicId ? row.coverImage : null
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    slug: row.slug,
    title: decodeHtmlEntities(row.title),
    description: decodeHtmlEntities(row.description),
    excerpt: row.excerpt ? decodeHtmlEntities(row.excerpt) : null,
    format: row.format === 'html' ? 'html' : 'editor',
    contentHtml: row.contentHtml,
    coverImage: cover,
    coverAlt: cover?.altText ? decodeHtmlEntities(cover.altText) : null,
    coverCaption: cover?.caption ? decodeHtmlEntities(cover.caption) : null,
    category: row.category ? decodeHtmlEntities(row.category) : null,
    tags: Array.isArray(row.tags) ? row.tags.map((t) => decodeHtmlEntities(String(t))) : [],
    faqs: toFaqs(row.faqs),
    authorId: row.authorId,
    seoTitle: row.seoTitle ? decodeHtmlEntities(row.seoTitle) : null,
    focusKeyword: row.focusKeyword,
    status: row.status === 'published' || row.status === 'review' ? row.status : 'draft',
    publishedAt: row.publishedAt,
    readingMinutes: row.readingMinutes,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

// ---------------------------------------------------------------------------
// Admin reads
// ---------------------------------------------------------------------------

export type PostListFilter = {
  status?: DisplayStatus | 'all'
  q?: string
  /** Restrict to one creator — how writers see only their own posts. */
  createdBy?: string
}

export async function listPosts(tx: Tx, workspaceId: string, filter: PostListFilter = {}): Promise<Post[]> {
  const now = new Date()
  const where: SQL[] = [eq(posts.workspaceId, workspaceId)]
  if (filter.createdBy) where.push(eq(posts.createdBy, filter.createdBy))
  switch (filter.status) {
    case 'draft':
      where.push(eq(posts.status, 'draft'))
      break
    case 'review':
      where.push(eq(posts.status, 'review'))
      break
    case 'scheduled':
      where.push(eq(posts.status, 'published'), gt(posts.publishedAt, now))
      break
    case 'published':
      where.push(live(now))
      break
  }
  const q = filter.q?.trim().slice(0, 100)
  if (q) {
    const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
    where.push(or(ilike(posts.title, pattern), ilike(posts.slug, pattern), ilike(posts.category, pattern))!)
  }
  const rows = await tx
    .select()
    .from(posts)
    .where(and(...where))
    .orderBy(desc(posts.updatedAt))
    .limit(500)
  return rows.map(toPost)
}

export async function getPost(tx: Tx, workspaceId: string, id: string): Promise<Post | null> {
  const [row] = await tx
    .select()
    .from(posts)
    .where(and(eq(posts.workspaceId, workspaceId), eq(posts.id, id)))
    .limit(1)
  return row ? toPost(row) : null
}

export async function slugTaken(tx: Tx, workspaceId: string, slug: string, excludeId?: string): Promise<boolean> {
  const [row] = await tx
    .select({ id: posts.id })
    .from(posts)
    .where(and(eq(posts.workspaceId, workspaceId), eq(posts.slug, slug), excludeId ? ne(posts.id, excludeId) : undefined))
    .limit(1)
  return Boolean(row)
}

export async function usedCategories(tx: Tx, workspaceId: string): Promise<string[]> {
  const rows = await tx
    .selectDistinct({ category: posts.category })
    .from(posts)
    .where(and(eq(posts.workspaceId, workspaceId), isNotNull(posts.category), ne(posts.category, '')))
  return rows.map((r) => r.category!).sort((a, b) => a.localeCompare(b))
}

export async function usedTags(tx: Tx, workspaceId: string): Promise<string[]> {
  const rows = await tx.execute<{ tag: string }>(
    sql`select distinct jsonb_array_elements_text(${posts.tags}) as tag from ${posts} where ${posts.workspaceId} = ${workspaceId}`
  )
  return rowsOf<{ tag: string }>(rows)
    .map((r) => r.tag)
    .filter((t) => t.trim())
    .sort((a, b) => a.localeCompare(b))
}

/** Drizzle returns `{ rows }` from node-postgres and PGlite alike. */
export function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  return ((result as { rows?: T[] }).rows ?? []) as T[]
}

export async function countPostsByAuthor(tx: Tx, workspaceId: string, authorId: string): Promise<number> {
  const [row] = await tx
    .select({ n: count() })
    .from(posts)
    .where(and(eq(posts.workspaceId, workspaceId), eq(posts.authorId, authorId)))
  return row.n
}

export type DashboardStats = {
  drafts: number
  review: number
  scheduled: number
  published: number
  nextScheduled: { id: string; title: string; publishedAt: Date } | null
  /** Posts that went live per day, oldest first, for the last `days` days. */
  daily: { day: string; count: number }[]
  recent: Post[]
}

export async function dashboardStats(tx: Tx, workspaceId: string, days = 30): Promise<DashboardStats> {
  const now = new Date()
  const ws = eq(posts.workspaceId, workspaceId)
  const [[drafts], [review], [scheduled], [published]] = await Promise.all([
    tx.select({ n: count() }).from(posts).where(and(ws, eq(posts.status, 'draft'))),
    tx.select({ n: count() }).from(posts).where(and(ws, eq(posts.status, 'review'))),
    tx.select({ n: count() }).from(posts).where(and(ws, eq(posts.status, 'published'), gt(posts.publishedAt, now))),
    tx.select({ n: count() }).from(posts).where(and(ws, live(now))),
  ])
  const [next] = await tx
    .select({ id: posts.id, title: posts.title, publishedAt: posts.publishedAt })
    .from(posts)
    .where(and(ws, eq(posts.status, 'published'), gt(posts.publishedAt, now)))
    .orderBy(asc(posts.publishedAt))
    .limit(1)
  const since = new Date(now.getTime() - days * 86_400_000)
  const liveRows = await tx
    .select({ publishedAt: posts.publishedAt })
    .from(posts)
    .where(and(ws, live(now), gt(posts.publishedAt, since)))
  const buckets = new Map<string, number>()
  for (let i = days - 1; i >= 0; i--) {
    buckets.set(new Date(now.getTime() - i * 86_400_000).toISOString().slice(0, 10), 0)
  }
  for (const r of liveRows) {
    const key = r.publishedAt!.toISOString().slice(0, 10)
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1)
  }
  const recentRows = await tx.select().from(posts).where(ws).orderBy(desc(posts.updatedAt)).limit(6)
  return {
    drafts: drafts.n,
    review: review.n,
    scheduled: scheduled.n,
    published: published.n,
    nextScheduled: next ? { id: next.id, title: decodeHtmlEntities(next.title), publishedAt: next.publishedAt! } : null,
    daily: [...buckets].map(([day, n]) => ({ day, count: n })),
    recent: recentRows.map(toPost),
  }
}

// ---------------------------------------------------------------------------
// Public reads (the content API)
// ---------------------------------------------------------------------------

export async function livePosts(
  tx: Tx,
  workspaceId: string,
  opts: { limit: number; offset: number; tagSlug?: string; authorId?: string }
): Promise<{ posts: Post[]; total: number }> {
  const now = new Date()
  const where: SQL[] = [eq(posts.workspaceId, workspaceId), live(now)]
  if (opts.tagSlug) where.push(sql`${posts.tagSlugs} @> ${JSON.stringify([opts.tagSlug])}::jsonb`)
  if (opts.authorId) where.push(eq(posts.authorId, opts.authorId))
  const [{ n }] = await tx.select({ n: count() }).from(posts).where(and(...where))
  const rows = await tx
    .select()
    .from(posts)
    .where(and(...where))
    .orderBy(desc(posts.publishedAt), desc(posts.id))
    .limit(opts.limit)
    .offset(opts.offset)
  return { posts: rows.map(toPost), total: n }
}

export async function livePostBySlug(tx: Tx, workspaceId: string, slug: string): Promise<Post | null> {
  const [row] = await tx
    .select()
    .from(posts)
    .where(and(eq(posts.workspaceId, workspaceId), eq(posts.slug, slug), live(new Date())))
    .limit(1)
  return row ? toPost(row) : null
}

/** Up to `limit` other live posts sharing a tag (falls back to the newest). */
export async function relatedPosts(tx: Tx, workspaceId: string, post: Post, limit = 3): Promise<Post[]> {
  const now = new Date()
  const slugs = post.tags.map(tagSlug).filter(Boolean)
  const base = and(eq(posts.workspaceId, workspaceId), live(now), ne(posts.id, post.id))
  const tagged = slugs.length
    ? await tx
        .select()
        .from(posts)
        .where(and(base, sql`${posts.tagSlugs} ?| array[${sql.join(slugs.map((s) => sql`${s}`), sql`, `)}]::text[]`))
        .orderBy(desc(posts.publishedAt))
        .limit(limit)
    : []
  if (tagged.length >= limit) return tagged.map(toPost)
  const fill = await tx
    .select()
    .from(posts)
    .where(and(base, tagged.length ? sql`${posts.id} not in ${tagged.map((r) => r.id)}` : undefined))
    .orderBy(desc(posts.publishedAt))
    .limit(limit - tagged.length)
  return [...tagged, ...fill].map(toPost)
}

export async function liveTags(tx: Tx, workspaceId: string): Promise<{ label: string; slug: string; count: number }[]> {
  const rows = await tx
    .select({ tags: posts.tags })
    .from(posts)
    .where(and(eq(posts.workspaceId, workspaceId), live(new Date())))
    .orderBy(desc(posts.publishedAt))
  const bySlug = new Map<string, { label: string; slug: string; count: number }>()
  for (const row of rows) {
    for (const raw of row.tags ?? []) {
      const label = decodeHtmlEntities(String(raw))
      const slug = tagSlug(label)
      if (!slug) continue
      const hit = bySlug.get(slug)
      if (hit) hit.count += 1
      else bySlug.set(slug, { label, slug, count: 1 })
    }
  }
  return [...bySlug.values()].sort((a, b) => a.label.localeCompare(b.label))
}

export async function liveIndex(tx: Tx, workspaceId: string): Promise<{ slug: string; updatedAt: Date; publishedAt: Date }[]> {
  const rows = await tx
    .select({ slug: posts.slug, updatedAt: posts.updatedAt, publishedAt: posts.publishedAt })
    .from(posts)
    .where(and(eq(posts.workspaceId, workspaceId), live(new Date())))
    .orderBy(desc(posts.publishedAt))
  return rows.map((r) => ({ slug: r.slug, updatedAt: r.updatedAt, publishedAt: r.publishedAt! }))
}

export async function liveAuthorIds(tx: Tx, workspaceId: string): Promise<string[]> {
  const rows = await tx
    .selectDistinct({ authorId: posts.authorId })
    .from(posts)
    .where(and(eq(posts.workspaceId, workspaceId), live(new Date()), isNotNull(posts.authorId)))
  return rows.map((r) => r.authorId!)
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export type PostRecord = Omit<Post, 'id' | 'workspaceId' | 'coverAlt' | 'coverCaption' | 'createdAt' | 'createdBy'>

function toRow(record: PostRecord) {
  return {
    slug: record.slug,
    title: record.title,
    description: record.description,
    excerpt: record.excerpt,
    format: record.format,
    contentHtml: record.contentHtml,
    coverImage: record.coverImage,
    category: record.category,
    tags: record.tags,
    tagSlugs: [...new Set(record.tags.map(tagSlug).filter(Boolean))],
    faqs: record.faqs,
    authorId: record.authorId,
    seoTitle: record.seoTitle,
    focusKeyword: record.focusKeyword,
    status: record.status,
    publishedAt: record.publishedAt,
    readingMinutes: record.readingMinutes,
    updatedBy: record.updatedBy,
    updatedAt: record.updatedAt,
  }
}

export async function insertPost(tx: Tx, workspaceId: string, createdBy: string, record: PostRecord): Promise<string> {
  const id = newId()
  await tx.insert(posts).values({ ...toRow(record), id, workspaceId, createdBy, createdAt: record.updatedAt })
  return id
}

export async function updatePost(tx: Tx, workspaceId: string, id: string, record: PostRecord): Promise<void> {
  await tx
    .update(posts)
    .set(toRow(record))
    .where(and(eq(posts.workspaceId, workspaceId), eq(posts.id, id)))
}

export async function deletePostRow(tx: Tx, workspaceId: string, id: string): Promise<void> {
  await tx.delete(posts).where(and(eq(posts.workspaceId, workspaceId), eq(posts.id, id)))
}

export async function postsByIds(tx: Tx, workspaceId: string, ids: string[]): Promise<Post[]> {
  if (!ids.length) return []
  const rows = await tx
    .select()
    .from(posts)
    .where(and(eq(posts.workspaceId, workspaceId), inArray(posts.id, ids)))
  return rows.map(toPost)
}
