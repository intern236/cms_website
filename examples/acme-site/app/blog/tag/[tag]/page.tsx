import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { tagMetadata } from '@cms/site-kit/next'
import { cms } from '@/cms'
import { TagPage } from '@/theme/blog/pages'

export const revalidate = 60
export const generateStaticParams = () => []

export async function generateMetadata({ params }: { params: Promise<{ tag: string }> }): Promise<Metadata> {
  const data = await cms.tag((await params).tag)
  return data ? tagMetadata(data.site, data.tag) : {}
}

export default async function Tag({ params }: { params: Promise<{ tag: string }> }) {
  const data = await cms.tag((await params).tag)
  if (!data) notFound()
  return <TagPage data={data} />
}
