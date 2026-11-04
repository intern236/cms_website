import { describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { inWorkspace, newId, sys } from '@/lib/db'
import { posts, users, workspaces } from '@/lib/db/schema'

async function makeWorkspace(slug: string) {
  const db = await sys()
  const id = newId()
  await db.insert(workspaces).values({ id, slug, name: slug, webhookSecret: 'x' })
  return id
}

describe('row-level security', () => {
  it('hides other workspaces and refuses cross-workspace writes', async () => {
    const a = await makeWorkspace('alpha')
    const b = await makeWorkspace('bravo')
    await inWorkspace(a, (tx) => tx.insert(posts).values({ id: newId(), workspaceId: a, slug: 'one', title: 'A post' }))
    await inWorkspace(b, (tx) => tx.insert(posts).values({ id: newId(), workspaceId: b, slug: 'one', title: 'B post' }))

    // No WHERE clause at all: still only sees its own.
    const seenByA = await inWorkspace(a, (tx) => tx.select().from(posts))
    expect(seenByA.map((p) => p.title)).toEqual(['A post'])

    // Writing a row for another workspace is refused by the policy.
    await expect(
      inWorkspace(a, (tx) => tx.insert(posts).values({ id: newId(), workspaceId: b, slug: 'two', title: 'smuggled' }))
    ).rejects.toThrow()

    // Updating everything only touches its own rows.
    await inWorkspace(a, (tx) => tx.update(posts).set({ title: 'renamed' }))
    const all = await (await sys()).select().from(posts)
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
    expect(await denied(() => inWorkspace(a, (tx) => tx.select().from(users)))).toMatch(/permission denied/)
    expect(await denied(() => inWorkspace(a, (tx) => tx.select().from(workspaces)))).toMatch(/permission denied/)
  })

  it('without a pinned workspace the role sees nothing', async () => {
    const db = await sys()
    const rows = await db.transaction(async (tx) => {
      await tx.execute(sql`set local role cms_app`)
      return tx.select().from(posts)
    })
    expect(rows).toEqual([])
  })
})
