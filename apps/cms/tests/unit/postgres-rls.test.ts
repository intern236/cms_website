import { afterAll, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { openDatabase } from '@/lib/db/postgres/open'
import { posts, users, workspaces } from '@/lib/db/postgres/schema'
import { newId } from '@/lib/db'

/**
 * Postgres row-level security, checked directly against the migrations — on a
 * private in-memory PGlite, so it runs whichever database the rest of the suite
 * uses. This is the database-level half of client isolation for the Postgres
 * adapter; tests/unit/mongo-fence.test.ts is MongoDB's counterpart.
 */

const handle = openDatabase('pglite', 'pglite:memory')
afterAll(() => handle.close())

async function db() {
  await handle.ready
  return handle.db
}

/** What the Postgres adapter's inWorkspace() does, minus the adapter. */
async function asWorkspace<T>(workspaceId: string, fn: (tx: Parameters<Parameters<Awaited<ReturnType<typeof db>>['transaction']>[0]>[0]) => Promise<T>) {
  return (await db()).transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.workspace_id', ${workspaceId}, true)`)
    await tx.execute(sql`set local role cms_app`)
    return fn(tx)
  })
}

async function makeWorkspace(slug: string) {
  const id = newId()
  await (await db()).insert(workspaces).values({ id, slug, name: slug, webhookSecret: 'x' })
  return id
}

describe('row-level security', () => {
  it('hides other workspaces and refuses cross-workspace writes', async () => {
    const a = await makeWorkspace('alpha')
    const b = await makeWorkspace('bravo')
    await asWorkspace(a, (tx) => tx.insert(posts).values({ id: newId(), workspaceId: a, slug: 'one', title: 'A post' }))
    await asWorkspace(b, (tx) => tx.insert(posts).values({ id: newId(), workspaceId: b, slug: 'one', title: 'B post' }))

    // No WHERE clause at all: still only sees its own.
    const seenByA = await asWorkspace(a, (tx) => tx.select().from(posts))
    expect(seenByA.map((p) => p.title)).toEqual(['A post'])

    // Writing a row for another workspace is refused by the policy.
    await expect(asWorkspace(a, (tx) => tx.insert(posts).values({ id: newId(), workspaceId: b, slug: 'two', title: 'smuggled' }))).rejects.toThrow()

    // Updating everything only touches its own rows.
    await asWorkspace(a, (tx) => tx.update(posts).set({ title: 'renamed' }))
    const all = await (await db()).select().from(posts)
    expect(all.map((p) => p.title).sort()).toEqual(['B post', 'renamed'])
  })

  it('the restricted role cannot read system tables', async () => {
    const a = await makeWorkspace('charlie')
    const denied = async (fn: () => Promise<unknown>) => {
      try {
        await fn()
        return 'allowed'
      } catch (error) {
        const cause = (error as { cause?: Error }).cause
        return String(cause?.message ?? error)
      }
    }
    expect(await denied(() => asWorkspace(a, (tx) => tx.select().from(users)))).toMatch(/permission denied/)
    expect(await denied(() => asWorkspace(a, (tx) => tx.select().from(workspaces)))).toMatch(/permission denied/)
  })

  it('without a pinned workspace the role sees nothing', async () => {
    const rows = await (await db()).transaction(async (tx) => {
      await tx.execute(sql`set local role cms_app`)
      return tx.select().from(posts)
    })
    expect(rows).toEqual([])
  })
})
