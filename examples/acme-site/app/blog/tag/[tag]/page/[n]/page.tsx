import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { tagMetadata } from '@cms/site-kit/next'
import { cms } from '@/cms'
import { TagPage } from '@/theme/blog/pages'

export const revalidate = 60
export const generateStaticParams = () => []

export async function generateMetadata({ params }: { params: Promise<{ tag: string; n: string }> }): Promise<Metadata> {
  const { tag, n } = await params
  const data = /^\d{1,5}$/.test(n) ? await cms.tag(tag, Number(n)) : null
  return data ? tagMetadata(data.site, data.tag, Number(n)) : {}
}

export default async function TagPaged({ params }: { params: Promise<{ tag: string; n: string }> }) {
  const { tag, n } = await params
  const data = /^\d{1,5}$/.test(n) && Number(n) > 1 ? await cms.tag(tag, Number(n)) : null
  if (!data) notFound()
  return <TagPage data={data} />
}
