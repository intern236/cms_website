import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cms } from '@/cms'
import { PostView } from '@/theme/blog/post-view'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Preview', robots: { index: false, follow: false } }

/**
 * Draft preview. The CMS editor opens /preview?token=…; the token is signed by the
 * CMS, lasts 15 minutes and only works for this site.
 */
export default async function Preview({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams
  const data = typeof token === 'string' ? await cms.preview(token) : null
  if (!data) notFound()
  return <PostView site={data.site} post={data.post} related={[]} preview />
}
