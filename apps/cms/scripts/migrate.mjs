// Brings the database up to date. `npm start` runs this before the server.
//
// MongoDB (DATABASE_URL=mongodb://… or mongodb+srv://…): creates missing
// collections, applies validators and indexes, and runs data migrations
// (lib/db/mongo/schema.mjs). Idempotent; the app also does this when it starts.
// Postgres (DATABASE_URL=postgres://…): applies drizzle/*.sql in order, once each,
// inside a lock, so several app instances starting together cannot race.
// PGlite (DATABASE_URL=pglite…): nothing to do — it migrates itself on start.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import nextEnv from '@next/env'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
nextEnv.loadEnvConfig(root, process.env.NODE_ENV !== 'production')

const url = process.env.DATABASE_URL?.trim()
if (!url) {
  console.error('[migrate] DATABASE_URL is not set. Set it to your mongodb:// (or postgres://) address. See .env.example.')
  process.exit(1)
}

if (/^mongodb(\+srv)?:\/\//.test(url)) {
  const { MongoClient } = await import('mongodb')
  const { ensureSchema, SCHEMA_VERSION } = await import('../lib/db/mongo/schema.mjs')
  const client = new MongoClient(url, { serverSelectionTimeoutMS: 15_000 })
  const started = Date.now()
  try {
    await client.connect()
    const name = new URL(url.replace(/^mongodb(\+srv)?:/, 'http:')).pathname.slice(1) || 'cms'
    await ensureSchema(client.db(name))
    console.log(`[migrate] MongoDB "${name}" is up to date (schema v${SCHEMA_VERSION}, ${Date.now() - started} ms).`)
  } catch (error) {
    console.error('[migrate] Failed:', error instanceof Error ? error.message : error)
    process.exitCode = 1
  } finally {
    await client.close()
  }
  process.exit()
}

if (!/^postgres(ql)?:\/\//.test(url)) {
  console.log('[migrate] PGlite migrates itself when the app opens it. Nothing to do.')
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
