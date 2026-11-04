import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { blogMetadata } from '@cms/site-kit/next'
import { cms } from '@/cms'
import { BlogPage } from '@/theme/blog/pages'

export const revalidate = 60

export async function generateMetadata(): Promise<Metadata> {
  return blogMetadata(await cms.site())
}

export default async function Blog() {
  const data = await cms.blogIndex(1)
  if (!data) notFound()
  return <BlogPage data={data} />
}
