import type { TestProject } from 'vitest/node'

/**
 * Which database the unit suite runs on (TEST_DB):
 *
 *   mongo (default)  a throwaway single-node MongoDB replica set, started here
 *                    (or TEST_MONGO_URL, an existing replica set)
 *   pglite           an in-memory Postgres per test file
 *   postgres         TEST_POSTGRES_URL, a fresh database per test file
 *
 * Every test file gets a database of its own either way (see ./setup.ts).
 */

declare module 'vitest' {
  export interface ProvidedContext {
    mongoUrl: string
  }
}

export default async function setup(project: TestProject) {
  const kind = process.env.TEST_DB || 'mongo'
  if (kind !== 'mongo') return
  if (process.env.TEST_MONGO_URL) {
    project.provide('mongoUrl', process.env.TEST_MONGO_URL)
    return
  }
  const { MongoMemoryReplSet } = await import('mongodb-memory-server-core')
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })
  project.provide('mongoUrl', replSet.getUri())
  return async () => {
    await replSet.stop()
  }
}
