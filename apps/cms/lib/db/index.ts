import 'server-only'
import { randomBytes } from 'node:crypto'
import { sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from 'drizzle-orm/pg-core'
import type { ExtractTablesWithRelations } from 'drizzle-orm'
import * as schema from './schema'
import { openDatabase } from './open'

/**
 * THE DATABASE.
 *
 * - `DATABASE_URL=postgres://…` → real Postgres (production: Neon, Supabase, RDS, your VPS).
 * - unset → PGlite, a full Postgres compiled to run inside Node, stored in
 *   `data/pglite/`. Nothing to install; this is what `npm run dev` and the tests use.
 *
 * Same SQL, same migrations, same row-level security either way.
 *
 * TWO DOORS, ON PURPOSE:
 *
 * - `sys()` is the app's own connection. Auth, users, workspaces, keys, sessions.
 *   It can see every row of every table, so it is used only by code that applies its
 *   own workspace filter and never for client content.
 * - `inWorkspace(id, fn)` is the only way to reach client content. It opens a
 *   transaction, switches to the restricted `cms_app` role and pins
 *   `app.workspace_id`; Postgres then hides every other client's rows, even from a
 *   query that forgot its WHERE clause. `cms_app` cannot read users, sessions or keys
 *   at all.
 */

export type Schema = typeof schema
export type Db = PgDatabase<PgQueryResultHKT, Schema>
export type Tx = PgTransaction<PgQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>

type Handle = { db: Db; ready: Promise<void>; close: () => Promise<void> }

const g = globalThis as unknown as { __cmsDb?: Handle }

function handle(): Handle {
  if (!g.__cmsDb) g.__cmsDb = openDatabase()
  return g.__cmsDb
}

/** The app's own connection. NOT for client content — use inWorkspace(). */
export async function sys(): Promise<Db> {
  const h = handle()
  await h.ready
  return h.db
}

/**
 * Runs `fn` with client content visible for one workspace only.
 *
 * The workspace id must come from the server (a membership check, a verified site
 * key), never straight from a request.
 */
export async function inWorkspace<T>(workspaceId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!isId(workspaceId)) throw new Error('inWorkspace: invalid workspace id')
  const db = await sys()
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.workspace_id', ${workspaceId}, true)`)
    await tx.execute(sql`set local role cms_app`)
    return fn(tx as Tx)
  })
}

/** For tests and scripts. */
export async function closeDatabase() {
  const h = g.__cmsDb
  if (!h) return
  g.__cmsDb = undefined
  await h.close()
}

export function newId(): string {
  return randomBytes(12).toString('hex')
}

export function isId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{24}$/.test(value)
}

export { schema }
