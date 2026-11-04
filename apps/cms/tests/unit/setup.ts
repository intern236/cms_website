import { vi } from 'vitest'
import { nextCache, nextHeaders, nextNavigation } from './next-mocks'

process.env.PGLITE_DIR = 'memory://'
process.env.CMS_SECRET = 'unit-test-secret-unit-test-secret-unit-test-secret'
process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = 'demo-cloud'
process.env.CMS_URL = 'https://cms.test'
delete process.env.SMTP_HOST
delete process.env.DATABASE_URL

/*
 * TEST_POSTGRES_URL=postgres://user:pw@host/db runs the suite against a real
 * Postgres instead: each test file gets its own fresh database, created from that
 * connection (whose user needs CREATEDB and CREATEROLE), migrated the way
 * production is.
 */
const admin = process.env.TEST_POSTGRES_URL?.trim()
if (admin) {
  const { default: pg } = await import('pg')
  const name = `cms_test_${process.pid}_${Math.random().toString(36).slice(2, 8)}`
  const client = new pg.Client({ connectionString: admin })
  await client.connect()
  await client.query(`CREATE DATABASE ${name}`)
  await client.end()
  const url = new URL(admin)
  url.pathname = `/${name}`
  process.env.DATABASE_URL = url.toString()
  process.env.CMS_AUTO_MIGRATE = 'true'
}

vi.mock('next/headers', () => nextHeaders)
vi.mock('next/navigation', () => nextNavigation)
vi.mock('next/cache', () => nextCache)
