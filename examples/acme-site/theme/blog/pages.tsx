import type { Cms } from '@cms/site-kit'
import { CollectionSchema } from '@cms/site-kit/ui'
import { Container } from '../components/container'
import { PageIntro, Pagination, PostGrid, TagRow } from './grid'

type BlogData = NonNullable<Awaited<ReturnType<Cms['blogIndex']>>>
type TagData = NonNullable<Awaited<ReturnType<Cms['tag']>>>

export function BlogPage({ data }: { data: BlogData }) {
  const { site, posts, tags } = data
  return (
    <Container>
      <CollectionSchema site={site} name={site.blog.title} description={site.blog.description} path={site.blog.basePath} posts={posts.items} />
      <PageIntro kicker={posts.page > 1 ? `Page ${posts.page} of ${posts.totalPages}` : `${posts.total} articles`} title={site.blog.title}>
        {site.blog.description}
      </PageIntro>
      <div className="mb-16">
        <TagRow tags={tags} />
      </div>
      {posts.items.length ? (
        <PostGrid posts={posts.items} featureFirst={posts.page === 1} />
      ) : (
        <p className="py-24 text-center font-display text-[32px] font-bold tracking-[-0.03em] text-mute">Nothing published yet.</p>
      )}
      <Pagination paged={posts} />
      <div className="h-32" />
    </Container>
  )
}

export function TagPage({ data }: { data: TagData }) {
  return (
    <Container>
      <PageIntro kicker={`${data.posts.total} ${data.posts.total === 1 ? 'article' : 'articles'} tagged`} title={data.tag.label} />
      <PostGrid posts={data.posts.items} featureFirst={false} />
      <Pagination paged={data.posts} />
      <div className="h-32" />
    </Container>
  )
}
