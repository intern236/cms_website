import { inject, vi } from 'vitest'
import { nextCache, nextHeaders, nextNavigation } from './next-mocks'

process.env.CMS_SECRET = 'unit-test-secret-unit-test-secret-unit-test-secret'
process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = 'demo-cloud'
process.env.CMS_URL = 'https://cms.test'
delete process.env.SMTP_HOST
delete process.env.DATABASE_URL

/* Each test file gets its own fresh database, on whichever backend TEST_DB names
   (see ./global-setup.ts). */
const kind = process.env.TEST_DB || 'mongo'
const dbName = `cms_test_${process.pid}_${Math.random().toString(36).slice(2, 8)}`

if (kind === 'mongo') {
  const url = new URL(inject('mongoUrl'))
  url.pathname = `/${dbName}`
  process.env.DATABASE_URL = url.toString()
} else if (kind === 'pglite') {
  process.env.DATABASE_URL = 'pglite:memory'
} else if (kind === 'postgres') {
  /* TEST_POSTGRES_URL's user needs CREATEDB and CREATEROLE. Migrated the way production is. */
  const admin = process.env.TEST_POSTGRES_URL?.trim()
  if (!admin) throw new Error('TEST_DB=postgres needs TEST_POSTGRES_URL')
  const { default: pg } = await import('pg')
  const client = new pg.Client({ connectionString: admin })
  await client.connect()
  await client.query(`CREATE DATABASE ${dbName}`)
  await client.end()
  const url = new URL(admin)
  url.pathname = `/${dbName}`
  process.env.DATABASE_URL = url.toString()
  process.env.CMS_AUTO_MIGRATE = 'true'
} else {
  throw new Error(`Unknown TEST_DB=${kind}: use mongo, pglite or postgres`)
}

vi.mock('next/headers', () => nextHeaders)
vi.mock('next/navigation', () => nextNavigation)
vi.mock('next/cache', () => nextCache)
