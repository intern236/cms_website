// Brings the database up to date. `npm start` runs this before the server.
//
// Postgres (DATABASE_URL=postgres://…): applies drizzle/*.sql in order, once each,
// inside a lock, so several app instances starting together cannot race.
// PGlite (no DATABASE_URL): nothing to do here — the app migrates its own local
// database when it opens it.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import nextEnv from '@next/env'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
nextEnv.loadEnvConfig(root, process.env.NODE_ENV !== 'production')

const url = process.env.DATABASE_URL?.trim()
if (!url || !/^postgres(ql)?:\/\//.test(url)) {
  console.log('[migrate] No DATABASE_URL — using the local PGlite database, which migrates itself on start.')
  process.exit(0)
}

const { default: pg } = await import('pg')
const { drizzle } = await import('drizzle-orm/node-postgres')
const { migrate } = await import('drizzle-orm/node-postgres/migrator')

const pool = new pg.Pool({
  connectionString: url,
  max: 1,
  ssl: /sslmode=(require|verify)/.test(url) ? { rejectUnauthorized: !/sslmode=require/.test(url) } : undefined,
})
const client = await pool.connect()
try {
  // One migrator at a time across every instance (an arbitrary, fixed lock id).
  await client.query('SELECT pg_advisory_lock(73217001)')
  const started = Date.now()
  await migrate(drizzle(client), { migrationsFolder: path.join(root, 'drizzle') })
  console.log(`[migrate] Database is up to date (${Date.now() - started} ms).`)
} catch (error) {
  console.error('[migrate] Failed:', error instanceof Error ? error.message : error)
  if (String(error).includes('permission denied') || String(error).includes('must have')) {
    console.error('[migrate] The database user needs CREATEROLE once, to create the restricted cms_app role. See README → Deploying.')
  }
  process.exitCode = 1
} finally {
  await client.query('SELECT pg_advisory_unlock(73217001)').catch(() => {})
  client.release()
  await pool.end()
}
