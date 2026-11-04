import Link from 'next/link'
import type { Paged, PostSummary } from '@cms/site-kit'
import { Reveal } from '../motion/reveal'
import { PostCard } from './post-card'

/**
 * Posts in a dense grid. On page 1 the newest post is featured (2×2); the grid
 * uses grid-flow-dense so the cards around it always pack without holes.
 */
export function PostGrid({ posts, featureFirst = true }: { posts: PostSummary[]; featureFirst?: boolean }) {
  return (
    <Reveal className="grid grid-flow-dense gap-x-6 gap-y-16 md:grid-cols-3" stagger={0.06}>
      {posts.map((p, i) => (
        <PostCard key={p.id} post={p} feature={featureFirst && i === 0 && posts.length > 2} />
      ))}
    </Reveal>
  )
}

export function Pagination({ paged }: { paged: Paged<unknown> }) {
  if (paged.totalPages <= 1) return null
  return (
    <nav aria-label="Pages" className="mt-24 flex items-center justify-center gap-2">
      {paged.prevUrl && (
        <Link href={paged.prevUrl} className="rounded-full border border-rule px-5 py-2.5 text-[15px] font-semibold transition hover:border-ink">
          Newer
        </Link>
      )}
      {paged.pages.map((p) => (
        <Link
          key={p.number}
          href={p.url}
          aria-current={p.current ? 'page' : undefined}
          className={`grid size-11 place-items-center rounded-full text-[15px] font-semibold transition ${p.current ? 'bg-ink text-paper' : 'hover:bg-paper-2'}`}
        >
          {p.number}
        </Link>
      ))}
      {paged.nextUrl && (
        <Link href={paged.nextUrl} className="rounded-full border border-rule px-5 py-2.5 text-[15px] font-semibold transition hover:border-ink">
          Older
        </Link>
      )}
    </nav>
  )
}

export function TagRow({ tags, active }: { tags: { label: string; slug: string; url: string; count?: number }[]; active?: string }) {
  if (!tags.length) return null
  return (
    <ul className="flex flex-wrap gap-2">
      {tags.map((t) => (
        <li key={t.slug}>
          <Link
            href={t.url}
            className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[14.5px] font-medium transition ${active === t.slug ? 'border-ink bg-ink text-paper' : 'border-rule hover:border-ink'}`}
          >
            {t.label}
            {t.count !== undefined && <span className="text-[12px] opacity-50">{t.count}</span>}
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function PageIntro({ kicker, title, children }: { kicker?: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="pb-16 pt-40 md:pb-24 md:pt-52">
      {kicker && <p className="mb-5 text-[15px] font-semibold text-mute">{kicker}</p>}
      <h1 className="max-w-6xl font-display text-[clamp(3rem,7.5vw,7.5rem)] font-extrabold leading-[0.88] tracking-[-0.06em]">{title}</h1>
      {children && <div className="mt-8 max-w-2xl text-[19px] leading-relaxed text-ink-2">{children}</div>}
    </header>
  )
}
