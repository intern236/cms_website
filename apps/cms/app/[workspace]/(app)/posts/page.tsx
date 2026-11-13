import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus } from '@phosphor-icons/react/dist/ssr'
import { PostsList, type PostRow } from '@/components/posts/posts-list'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { requireWorkspace } from '@/lib/auth/access'
import { thumbUrl } from '@/lib/cloudinary/url'
import { listAuthors } from '@/lib/content/authors'
import { displayStatus, listPosts } from '@/lib/content/posts'
import { readWorkspace } from '@/lib/db'
import { can } from '@/lib/permissions'
import { Fresh } from '@/components/fresh/fresh'

export const metadata: Metadata = { title: 'Posts' }

const FILTERS = ['all', 'draft', 'review', 'scheduled', 'published'] as const

export default async function PostsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  const { workspace: slug } = await params
  const sp = await searchParams
  const access = await requireWorkspace(slug)
  const { workspace, role, user } = access
  const status = (FILTERS as readonly string[]).includes(sp.status ?? '') ? (sp.status as (typeof FILTERS)[number]) : 'all'
  const q = typeof sp.q === 'string' ? sp.q.slice(0, 100) : ''
  const createdBy = can(role, 'posts.editAny') ? undefined : user.id

  /* Every post this person can see, once. The status tabs and the search box filter
     them in the browser, so switching is instant and costs no server trip. */
  const rows = await readWorkspace(workspace.id, async (tx) => {
    /* Posts and the (short) author list side by side: one round trip, not two. */
    const [all, authorList] = await Promise.all([listPosts(tx, workspace.id, { createdBy }), listAuthors(tx, workspace.id)])
    const authors = new Map(authorList.map((a) => [a.id, a]))
    return all.map((p): PostRow => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      status: displayStatus(p),
      category: p.category,
      author: p.authorId ? (authors.get(p.authorId)?.name ?? null) : null,
      cover: p.coverImage ? thumbUrl(p.coverImage.publicId, 160) : null,
      updatedAt: p.updatedAt.toISOString(),
      publishedAt: p.publishedAt?.toISOString() ?? null,
      readingMinutes: p.readingMinutes,
      tags: p.tags,
    }))
  })

  return (
    <>
      <Fresh />
      <PageHeader
        title="Posts"
        description={createdBy ? 'Your drafts and the posts you sent for review.' : `Everything on the ${workspace.settings.blog.title.toLowerCase()}, newest edit first.`}
        actions={
          can(role, 'posts.create') && (
            <Button asChild variant="brand">
              <Link href={`/${slug}/posts/new`} prefetch>
                <Plus weight="bold" />
                New post
              </Link>
            </Button>
          )
        }
      />
      <PostsList base={`/${slug}`} posts={rows} status={status} q={q} canCreate={can(role, 'posts.create')} />
    </>
  )
}
