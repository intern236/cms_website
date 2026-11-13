import type { Metadata } from 'next'
import { PostEditor } from '@/components/editor/post-editor'
import { requireWorkspace } from '@/lib/auth/access'
import { readWorkspace } from '@/lib/db'
import { editorContext } from '@/lib/editor-context'
import { Fresh } from '@/components/fresh/fresh'

export const metadata: Metadata = { title: 'New post' }

export default async function NewPost({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params
  const access = await requireWorkspace(workspace, 'posts.create')
  const ctx = await readWorkspace(access.workspace.id, (tx) => editorContext(tx, access))
  return (
    <>
      <Fresh />
      <PostEditor post={null} ctx={ctx} />
    </>
  )
}
