import type { Metadata } from 'next'
import { AuthorsBoard } from '@/components/authors/authors-board'
import { PageHeader } from '@/components/ui/page-header'
import { requireWorkspace } from '@/lib/auth/access'
import { cloudinaryConfigured } from '@/lib/cloudinary/config'
import { listAuthors } from '@/lib/content/authors'
import { postCountsByAuthor } from '@/lib/content/posts'
import { readWorkspace } from '@/lib/db'
import { Fresh } from '@/components/fresh/fresh'

export const metadata: Metadata = { title: 'Authors' }

export default async function AuthorsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params
  const access = await requireWorkspace(workspace, 'authors.manage')
  const wsId = access.workspace.id
  /* The authors and everyone's post count, side by side: one round trip. */
  const authors = await readWorkspace(wsId, async (tx) => {
    const [list, counts] = await Promise.all([listAuthors(tx, wsId), postCountsByAuthor(tx, wsId)])
    return list.map((a) => ({ ...a, posts: Object.hasOwn(counts, a.id) ? counts[a.id] : 0 }))
  })
  return (
    <>
      <Fresh />
      <PageHeader title="Authors" description="The people behind the posts. Each gets a byline, a photo and a profile page." />
      <AuthorsBoard
        workspace={workspace}
        uploadsEnabled={cloudinaryConfigured()}
        authors={authors.map((a) => ({
          id: a.id,
          name: a.name,
          slug: a.slug,
          role: a.role,
          bio: a.bio,
          avatar: a.avatar,
          avatarAlt: a.avatarAlt,
          linkedinUrl: a.linkedinUrl,
          xUrl: a.xUrl,
          websiteUrl: a.websiteUrl,
          posts: a.posts,
        }))}
      />
    </>
  )
}
