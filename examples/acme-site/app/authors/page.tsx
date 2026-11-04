import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { pageMetadata } from '@cms/site-kit/next'
import { cms } from '@/cms'
import { AuthorTile } from '@/theme/components/author-tile'
import { Container } from '@/theme/components/container'
import { PageIntro } from '@/theme/blog/grid'
import { Reveal } from '@/theme/motion/reveal'

export const revalidate = 60

export async function generateMetadata(): Promise<Metadata> {
  const site = await cms.site()
  return pageMetadata(site, { title: 'People', description: `The people who write for ${site.name}.`, path: '/authors' })
}

export default async function Authors() {
  const site = await cms.site()
  if (!site.blog.authors) notFound()
  const authors = await cms.authors()
  return (
    <Container>
      <PageIntro kicker={`${authors.length} writers`} title="The people behind the words." />
      <Reveal className="grid grid-flow-dense gap-5 md:grid-cols-3">
        {authors.map((a) => (
          <AuthorTile key={a.id} author={a} />
        ))}
      </Reveal>
      <div className="h-40" />
    </Container>
  )
}
