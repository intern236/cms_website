import { sql } from 'drizzle-orm'
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

/**
 * THE SCHEMA. One Postgres database holds every client.
 *
 * Two kinds of table:
 *
 * - SYSTEM tables (users, workspaces, sessions, keys…) are read and written by the
 *   app's own code paths with an explicit workspace filter where one applies.
 * - CLIENT CONTENT tables (posts, authors, contact_messages, contact_rate,
 *   audit_log) carry `workspace_id` and are protected by Postgres row-level security
 *   as well. Code reaches them only through `inWorkspace()` (lib/db/index.ts), which
 *   switches to the restricted `cms_app` role and pins the workspace for the
 *   transaction, so a query that forgets its WHERE clause still cannot see another
 *   client's rows. See migrations/0001_rls.sql.
 *
 * Ids are 24-hex strings made by newId(), timestamps are timestamptz.
 */

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' })

const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array }>({
  dataType: () => 'bytea',
  fromDriver: (value) => Buffer.from(value),
})

export type Role = 'owner' | 'editor' | 'writer'
export type PostStatus = 'draft' | 'review' | 'published'
export type PostFormat = 'editor' | 'html'

export interface StoredImage {
  url: string
  secureUrl: string
  publicId: string
  width: number
  height: number
  format: string
  bytes: number
  altText?: string
  caption?: string
}

// ---------------------------------------------------------------------------
// System tables
// ---------------------------------------------------------------------------

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  /** Always stored lower-cased; unique across the whole CMS. */
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  /** Your agency's own team: every workspace, plus the agency area. */
  isAgency: boolean('is_agency').notNull().default(false),
  /** Email a 6-digit code on every sign-in. */
  twoFactor: boolean('two_factor').notNull().default(false),
  disabledAt: ts('disabled_at'),
  lastLoginAt: ts('last_login_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
})

export const workspaces = pgTable('workspaces', {
  id: text('id').primaryKey(),
  /** In admin URLs (/acme/posts) and the Cloudinary folder. Never changes. */
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  /** The client's public website, e.g. https://acme.com — for links, previews and SEO. */
  siteUrl: text('site_url').notNull().default(''),
  /** Brand colour for their admin, buttons and emails. */
  accent: text('accent').notNull().default('#18181b'),
  hasLogo: boolean('has_logo').notNull().default(false),
  /** Everything that used to live in cms.config.ts. Validated by lib/workspaces/settings.ts. */
  settings: jsonb('settings').notNull().default({}),
  /** Where "content changed" is POSTed. Agency-only to edit. */
  webhookUrl: text('webhook_url').notNull().default(''),
  webhookSecret: text('webhook_secret').notNull(),
  archivedAt: ts('archived_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
})

export const workspaceLogos = pgTable('workspace_logos', {
  workspaceId: text('workspace_id')
    .primaryKey()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  contentType: text('content_type').notNull(),
  data: bytea('data').notNull(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
})

export const memberships = pgTable(
  'memberships',
  {
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').$type<Role>().notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.userId] }), index('memberships_user').on(t.userId)]
)

export const invites = pgTable(
  'invites',
  {
    id: text('id').primaryKey(),
    /** Null for an invite to the agency team. */
    workspaceId: text('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    /** A workspace role, or 'agency'. */
    role: text('role').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    invitedBy: text('invited_by').references(() => users.id, { onDelete: 'set null' }),
    expiresAt: ts('expires_at').notNull(),
    acceptedAt: ts('accepted_at'),
    revokedAt: ts('revoked_at'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('invites_workspace').on(t.workspaceId)]
)

export const sessions = pgTable(
  'sessions',
  {
    /** sha256 of the cookie value. The raw token is never stored. */
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    userAgent: text('user_agent').notNull().default(''),
    createdAt: ts('created_at').notNull().defaultNow(),
    lastSeenAt: ts('last_seen_at').notNull().defaultNow(),
    expiresAt: ts('expires_at').notNull(),
  },
  (t) => [index('sessions_user').on(t.userId)]
)

/** A password that was right, waiting for the emailed code. */
export const loginChallenges = pgTable('login_challenges', {
  /** sha256 of the pending cookie value. */
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  codeHash: text('code_hash').notNull(),
  attempts: integer('attempts').notNull().default(0),
  expiresAt: ts('expires_at').notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
})

export const passwordResets = pgTable('password_resets', {
  tokenHash: text('token_hash').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: ts('expires_at').notNull(),
  usedAt: ts('used_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
})

/** Failed sign-ins, keyed by hashed IP and by email. Rows older than the window are swept. */
export const loginAttempts = pgTable(
  'login_attempts',
  {
    id: text('id').primaryKey(),
    key: text('key').notNull(),
    at: ts('at').notNull().defaultNow(),
  },
  (t) => [index('login_attempts_key').on(t.key, t.at)]
)

export const siteKeys = pgTable(
  'site_keys',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    /** The visible part, `cms_<prefix>_…`, used to look the key up. */
    prefix: text('prefix').notNull().unique(),
    keyHash: text('key_hash').notNull(),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: ts('created_at').notNull().defaultNow(),
    lastUsedAt: ts('last_used_at'),
    revokedAt: ts('revoked_at'),
  },
  (t) => [index('site_keys_workspace').on(t.workspaceId)]
)

export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    event: text('event').notNull(),
    ok: boolean('ok').notNull(),
    status: integer('status'),
    error: text('error'),
    durationMs: integer('duration_ms'),
    at: ts('at').notNull().defaultNow(),
  },
  (t) => [index('webhook_deliveries_ws').on(t.workspaceId, t.at)]
)

/** Emails the CMS would have sent, when no SMTP server is configured (local dev, tests). */
export const outbox = pgTable('outbox', {
  id: text('id').primaryKey(),
  to: text('to').notNull(),
  subject: text('subject').notNull(),
  html: text('html').notNull(),
  text: text('text').notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
})

// ---------------------------------------------------------------------------
// Client content (row-level security)
// ---------------------------------------------------------------------------

export const authors = pgTable(
  'authors',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    role: text('role'),
    bio: text('bio'),
    avatar: jsonb('avatar').$type<StoredImage | null>(),
    linkedinUrl: text('linkedin_url'),
    xUrl: text('x_url'),
    websiteUrl: text('website_url'),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('authors_ws_slug').on(t.workspaceId, t.slug)]
)

export const posts = pgTable(
  'posts',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    excerpt: text('excerpt'),
    format: text('format').$type<PostFormat>().notNull().default('editor'),
    contentHtml: text('content_html').notNull().default(''),
    coverImage: jsonb('cover_image').$type<StoredImage | null>(),
    category: text('category'),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    /** slugify() of each tag, kept beside it so tag archives are one indexed query. */
    tagSlugs: jsonb('tag_slugs').$type<string[]>().notNull().default([]),
    faqs: jsonb('faqs').$type<{ question: string; answer: string }[]>().notNull().default([]),
    authorId: text('author_id'),
    seoTitle: text('seo_title'),
    focusKeyword: text('focus_keyword'),
    /** draft → review (a writer asks for it) → published. Future publishedAt = scheduled. */
    status: text('status').$type<PostStatus>().notNull().default('draft'),
    publishedAt: ts('published_at'),
    readingMinutes: integer('reading_minutes').notNull().default(1),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('posts_ws_slug').on(t.workspaceId, t.slug),
    index('posts_ws_live').on(t.workspaceId, t.status, t.publishedAt),
    index('posts_ws_author').on(t.workspaceId, t.authorId),
  ]
)

export const contactMessages = pgTable(
  'contact_messages',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    email: text('email').notNull(),
    phone: text('phone').notNull().default(''),
    company: text('company').notNull().default(''),
    topic: text('topic').notNull().default(''),
    message: text('message').notNull(),
    source: text('source'),
    userAgent: text('user_agent'),
    receivedAt: ts('received_at').notNull().defaultNow(),
    readAt: ts('read_at'),
    archived: boolean('archived').notNull().default(false),
  },
  (t) => [index('contact_ws_inbox').on(t.workspaceId, t.archived, t.receivedAt)]
)

export const contactRate = pgTable(
  'contact_rate',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    at: ts('at').notNull().defaultNow(),
  },
  (t) => [index('contact_rate_key').on(t.workspaceId, t.key, t.at)]
)

export const auditLog = pgTable(
  'audit_log',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    actorId: text('actor_id'),
    actorName: text('actor_name').notNull().default(''),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: text('target_id'),
    summary: text('summary').notNull().default(''),
    at: ts('at').notNull().default(sql`now()`),
  },
  (t) => [index('audit_ws_at').on(t.workspaceId, t.at)]
)

/** The tables row-level security protects. Kept in step with migrations/0001_rls.sql by a test. */
export const RLS_TABLES = ['authors', 'posts', 'contact_messages', 'contact_rate', 'audit_log'] as const
