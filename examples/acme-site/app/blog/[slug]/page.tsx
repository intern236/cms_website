import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { postMetadata } from '@cms/site-kit/next'
import { PostSchemas } from '@cms/site-kit/ui'
import { cms } from '@/cms'
import { PostView } from '@/theme/blog/post-view'

export const revalidate = 60
/* Nothing prebuilt: every post renders on first visit, then is cached for 60s or until the CMS says it changed. */
export const generateStaticParams = () => []

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const data = await cms.post((await params).slug)
  return data ? postMetadata(data.site, data.post) : {}
}

export default async function Post({ params }: { params: Promise<{ slug: string }> }) {
  const data = await cms.post((await params).slug)
  if (!data) notFound()
  return (
    <>
      <PostSchemas site={data.site} post={data.post} />
      <PostView site={data.site} post={data.post} related={data.related} />
    </>
  )
}
