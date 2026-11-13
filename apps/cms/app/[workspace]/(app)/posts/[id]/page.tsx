import type { Metadata } from 'next'
import { PostEditor, type EditorPost } from '@/components/editor/post-editor'
import { requireWorkspace } from '@/lib/auth/access'
import { displayStatus, hasGoneLive } from '@/lib/content/posts'
import { readWorkspace } from '@/lib/db'
import { editorContext } from '@/lib/editor-context'
import { editablePost } from './editable'
import { FreshRemount } from '@/components/fresh/fresh'

export const metadata: Metadata = { title: 'Edit post' }

export default async function EditPost({ params }: { params: Promise<{ workspace: string; id: string }> }) {
  const { workspace, id } = await params
  const access = await requireWorkspace(workspace, 'posts.create')
  /* The post (already checked by the layout, so this is the cached answer) and the editor's lists, at once. */
  const [{ post }, ctx] = await Promise.all([editablePost(workspace, id), readWorkspace(access.workspace.id, (tx) => editorContext(tx, access))])
  const editorPost: EditorPost = {
    id: post.id,
    title: post.title,
    slug: post.slug,
    description: post.description,
    excerpt: post.excerpt ?? '',
    format: post.format,
    contentHtml: post.contentHtml,
    coverImage: post.coverImage,
    coverAlt: post.coverAlt ?? '',
    coverCaption: post.coverCaption ?? '',
    category: post.category ?? '',
    tags: post.tags,
    faqs: post.faqs,
    authorId: post.authorId ?? '',
    seoTitle: post.seoTitle ?? '',
    focusKeyword: post.focusKeyword ?? '',
    status: displayStatus(post),
    publishedAt: post.publishedAt?.toISOString() ?? null,
    everLive: hasGoneLive(post),
    updatedAt: post.updatedAt.toISOString(),
  }
  /* Opened from a prefetched copy more than a few seconds old? Re-open with fresh data. */
  return (
    <FreshRemount>
      <PostEditor key={post.id} post={editorPost} ctx={ctx} />
    </FreshRemount>
  )
}
