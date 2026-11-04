import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import * as schema from './schema'
import type { Db } from './index'

const MIGRATIONS = path.join(/*turbopackIgnore: true*/ process.cwd(), 'drizzle')

/**
 * Opens the database named by the environment and starts migrating it.
 * Returns immediately; `ready` resolves once migrations have run.
 */
export function openDatabase(): { db: Db; ready: Promise<void>; close: () => Promise<void> } {
  const url = process.env.DATABASE_URL?.trim()
  return url && /^postgres(ql)?:\/\//.test(url) ? openPostgres(url) : openPglite()
}

function openPostgres(url: string) {
  // Imported lazily so a PGlite-only setup never loads the pg driver, and vice versa.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require('pg') as typeof import('pg')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require('drizzle-orm/node-postgres') as typeof import('drizzle-orm/node-postgres')
  const pool = new Pool({
    connectionString: url,
    max: Number(process.env.DATABASE_POOL_MAX || 10),
    ssl: /sslmode=(require|verify)/.test(url) ? { rejectUnauthorized: !/sslmode=require/.test(url) } : undefined,
  })
  const db = drizzle(pool, { schema }) as unknown as Db
  /* Production migrates explicitly (`npm run db:migrate`, run by `npm start`), so
     several app instances starting together never race each other. */
  const ready =
    process.env.CMS_AUTO_MIGRATE === 'true'
      ? (async () => {
          const { migrate } = await import('drizzle-orm/node-postgres/migrator')
          await migrate(db as never, { migrationsFolder: MIGRATIONS })
        })()
      : Promise.resolve()
  return { db, ready, close: () => pool.end() }
}

function openPglite() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PGlite } = require('@electric-sql/pglite') as typeof import('@electric-sql/pglite')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require('drizzle-orm/pglite') as typeof import('drizzle-orm/pglite')

  const dir = process.env.PGLITE_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), 'data', 'pglite')
  const inMemory = dir.startsWith('memory://')
  if (!inMemory) {
    mkdirSync(dir, { recursive: true })
    claimLock(dir)
  }
  const client = new PGlite(inMemory ? undefined : dir)
  const db = drizzle(client, { schema }) as unknown as Db
  const ready = (async () => {
    await client.waitReady
    const { migrate } = await import('drizzle-orm/pglite/migrator')
    await migrate(db as never, { migrationsFolder: MIGRATIONS })
  })()
  return {
    db,
    ready,
    close: async () => {
      await client.close()
      if (!inMemory) releaseLock(dir)
    },
  }
}

/**
 * PGlite is a single-process database: two processes writing one folder corrupt it.
 * A pid file turns that into a clear error instead.
 */
function claimLock(dir: string) {
  const file = path.join(dir, '.cms-lock')
  if (existsSync(file)) {
    const pid = Number(readFileSync(file, 'utf8'))
    if (pid && pid !== process.pid && alive(pid)) {
      throw new Error(
        `The local database (${dir}) is in use by another process (pid ${pid}). ` +
          'Stop it first, or point DATABASE_URL at a Postgres server.'
      )
    }
  }
  writeFileSync(file, String(process.pid))
  process.once('exit', () => releaseLock(dir))
}

function releaseLock(dir: string) {
  const file = path.join(dir, '.cms-lock')
  try {
    if (existsSync(file) && Number(readFileSync(file, 'utf8')) === process.pid) rmSync(file)
  } catch {
    /* best effort */
  }
}

function alive(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
