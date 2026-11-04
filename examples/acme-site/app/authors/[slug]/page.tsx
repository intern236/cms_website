import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { authorMetadata } from '@cms/site-kit/next'
import { PersonSchema } from '@cms/site-kit/ui'
import { cms } from '@/cms'
import { Container } from '@/theme/components/container'
import { Pagination, PostGrid } from '@/theme/blog/grid'
import { Avatar } from '@/theme/blog/post-card'

export const revalidate = 60
export const generateStaticParams = () => []

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const data = await cms.author((await params).slug)
  return data ? authorMetadata(data.site, data.author) : {}
}

export default async function Author({ params }: { params: Promise<{ slug: string }> }) {
  const data = await cms.author((await params).slug)
  if (!data) notFound()
  const { author, posts, site } = data
  return (
    <Container>
      <PersonSchema site={site} author={author} />
      <header className="grid gap-10 pb-20 pt-40 md:grid-cols-[auto_1fr] md:items-end md:pt-52">
        <Avatar author={author} size={160} />
        <div>
          {author.role && <p className="mb-3 text-[16px] font-semibold text-mute">{author.role}</p>}
          <h1 className="font-display text-[clamp(3rem,7vw,7rem)] font-extrabold leading-[0.88] tracking-[-0.06em]">{author.name}</h1>
          {author.bio && <p className="mt-6 max-w-2xl text-[19px] leading-relaxed text-ink-2">{author.bio}</p>}
          {author.links.length > 0 && (
            <div className="mt-6 flex gap-4 text-[15px] font-semibold">
              {author.links.map((l) => (
                <a key={l.url} href={l.url} target="_blank" rel="noreferrer me" className="underline decoration-accent decoration-2 underline-offset-4 hover:decoration-ink">
                  {l.label}
                </a>
              ))}
            </div>
          )}
        </div>
      </header>
      <PostGrid posts={posts.items} featureFirst={false} />
      <Pagination paged={posts} />
      <div className="h-32" />
    </Container>
  )
}
