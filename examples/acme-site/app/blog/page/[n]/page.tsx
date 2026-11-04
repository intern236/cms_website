import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { blogMetadata } from '@cms/site-kit/next'
import { cms } from '@/cms'
import { BlogPage } from '@/theme/blog/pages'

export const revalidate = 60
export const generateStaticParams = () => []

function parse(n: string) {
  return /^\d{1,5}$/.test(n) ? Number(n) : NaN
}

export async function generateMetadata({ params }: { params: Promise<{ n: string }> }): Promise<Metadata> {
  const n = parse((await params).n)
  return Number.isNaN(n) ? {} : blogMetadata(await cms.site(), n)
}

export default async function BlogPaged({ params }: { params: Promise<{ n: string }> }) {
  const n = parse((await params).n)
  if (n === 1) permanentRedirect((await cms.site()).blog.basePath)
  const data = Number.isNaN(n) ? null : await cms.blogIndex(n)
  if (!data) notFound()
  return <BlogPage data={data} />
}
