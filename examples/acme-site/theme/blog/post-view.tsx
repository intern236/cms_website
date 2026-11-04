import Link from 'next/link'
import type { PostDetail, PostSummary, Site } from '@cms/site-kit'
import { HtmlPage, PostHtml } from '@cms/site-kit/ui'
import { ArrowUpRight } from '@phosphor-icons/react/dist/ssr'
import { Container } from '../components/container'
import { Cover } from '../components/cover'
import { SplitWords } from '../motion/reveal'
import { Faq } from './faq'
import { PostGrid } from './grid'
import { Avatar } from './post-card'
import { ReadingProgress } from './reading-progress'

/** One post, written in the rich editor or pasted as a whole HTML page. */
export function PostView({ site, post, related, preview }: { site: Site; post: PostDetail; related: PostSummary[]; preview?: boolean }) {
  return (
    <article>
      <ReadingProgress />
      {preview && (
        <div className="fixed inset-x-0 bottom-4 z-50 mx-auto w-fit rounded-full bg-ink px-5 py-2.5 text-[14px] font-semibold text-paper shadow-2xl">
          Preview — not published yet
        </div>
      )}
      {post.body.kind === 'page' ? (
        <div className="pt-28">
          <HtmlPage body={post.body} />
        </div>
      ) : (
        <>
          <Container>
            <header className="pb-12 pt-40 md:pt-48">
              <div className="mb-8 flex flex-wrap items-center gap-3 text-[15px] text-mute">
                <Link href={site.blog.basePath} className="font-semibold text-ink-2 hover:text-accent">
                  {site.blog.title}
                </Link>
                {post.category && (
                  <>
                    <span aria-hidden>/</span>
                    <span>{post.category}</span>
                  </>
                )}
              </div>
              <h1 className="max-w-5xl font-display text-[clamp(2.75rem,6.2vw,6.25rem)] font-extrabold leading-[0.9] tracking-[-0.055em]">
                <SplitWords text={post.title} />
              </h1>
              {post.excerpt && <p className="mt-8 max-w-3xl text-[clamp(1.2rem,1.1rem+0.5vw,1.6rem)] leading-snug text-ink-2">{post.excerpt}</p>}
              <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-rule pt-6 text-[15px] text-mute">
                {post.author && (
                  <span className="flex items-center gap-3 text-ink">
                    <Avatar author={post.author} size={40} />
                    <span>
                      {post.author.url ? (
                        <Link href={post.author.url} className="font-semibold hover:text-accent">
                          {post.author.name}
                        </Link>
                      ) : (
                        <span className="font-semibold">{post.author.name}</span>
                      )}
                      {post.author.role && <span className="block text-[13.5px] text-mute">{post.author.role}</span>}
                    </span>
                  </span>
                )}
                <time dateTime={post.publishedAt.toISOString()}>{post.dateLabel}</time>
                <span>{post.readingMinutes} min read</span>
              </div>
            </header>
          </Container>
          <Container>
            <figure>
              <div className="aspect-[16/9] overflow-hidden rounded-[32px] bg-ink">
                <Cover cover={post.cover} title={post.title} category={post.category} sizes="100vw" eager />
              </div>
              {post.cover?.caption && <figcaption className="mt-3 text-[14px] text-mute">{post.cover.caption}</figcaption>}
            </figure>
          </Container>
          <Container className="grid gap-12 py-20 lg:grid-cols-[1fr_minmax(0,720px)_1fr]">
            <div className="lg:col-start-2">
              {post.body.split && site.cta ? (
                <>
                  <PostHtml html={post.body.split.before} className="prose-post" />
                  <MidCta cta={site.cta} />
                  <PostHtml html={post.body.split.after} className="prose-post" />
                </>
              ) : (
                <PostHtml html={post.body.html} className="prose-post" />
              )}
            </div>
          </Container>
        </>
      )}

      <Container>
        <div className="mx-auto max-w-[720px] pb-12">
          {post.faqs.length > 0 && <Faq items={post.faqs} />}
          {post.tags.length > 0 && (
            <ul className="mt-12 flex flex-wrap gap-2">
              {post.tags.map((t) => (
                <li key={t.slug}>
                  <Link href={t.url} className="inline-block rounded-full border border-rule px-4 py-2 text-[14.5px] font-medium transition hover:border-ink">
                    #{t.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {post.author && (
            <aside className="mt-16 flex flex-col gap-5 rounded-[28px] bg-paper-2 p-8 sm:flex-row sm:items-start">
              <Avatar author={post.author} size={72} />
              <div>
                <p className="text-[14px] text-mute">Written by</p>
                <p className="font-display text-[28px] font-bold leading-tight tracking-[-0.03em]">{post.author.name}</p>
                {post.author.bio && <p className="mt-3 text-[16.5px] leading-relaxed text-ink-2">{post.author.bio}</p>}
                {post.author.url && (
                  <Link href={post.author.url} className="mt-4 inline-flex items-center gap-1.5 text-[15px] font-semibold hover:text-accent">
                    More from {post.author.name.split(' ')[0]} <ArrowUpRight size={14} weight="bold" />
                  </Link>
                )}
              </div>
            </aside>
          )}
        </div>
      </Container>

      {related.length > 0 && (
        <section className="border-t border-rule py-32">
          <Container>
            <h2 className="mb-14 font-display text-[clamp(2.25rem,4vw,3.75rem)] font-bold tracking-[-0.045em]">Keep reading</h2>
            <PostGrid posts={related} featureFirst={false} />
          </Container>
        </section>
      )}
    </article>
  )
}

function MidCta({ cta }: { cta: NonNullable<Site['cta']> }) {
  return (
    <aside className="my-16 overflow-hidden rounded-[28px] bg-ink p-8 text-paper sm:p-10">
      <p className="font-display text-[clamp(1.75rem,2.8vw,2.5rem)] font-bold leading-[1.02] tracking-[-0.04em]">{cta.heading}</p>
      {cta.body && <p className="mt-3 max-w-lg text-[17px] leading-relaxed text-paper/70">{cta.body}</p>}
      <Link href={cta.href} className="group mt-6 inline-flex items-center gap-2 rounded-full bg-accent py-3 pl-5 pr-3 font-semibold text-accent-ink">
        {cta.label}
        <span className="grid size-7 place-items-center rounded-full bg-accent-ink/10 transition-transform duration-500 group-hover:rotate-45">
          <ArrowUpRight size={14} weight="bold" />
        </span>
      </Link>
    </aside>
  )
}
