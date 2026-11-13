'use client'

import { TimeAgo } from '@/components/ui/time-ago'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import { MagnifyingGlass, NotePencil, X } from '@phosphor-icons/react'
import { Avatar } from '@/components/ui/avatar'
import { LinkPending } from '@/components/ui/link-pending'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/misc'
import { Segmented } from '@/components/ui/segmented'
import { StatusPill, type StatusKind } from '@/components/ui/status'
import { prefetchOnHover } from '@/lib/prefetch'

export type PostRow = {
  id: string
  title: string
  slug: string
  status: StatusKind
  category: string | null
  author: string | null
  cover: string | null
  updatedAt: string
  publishedAt: string | null
  readingMinutes: number
  tags: string[]
}

type Filter = 'all' | StatusKind

export function PostsList({
  base,
  posts: all,
  status: initialStatus,
  q: initialQuery,
  canCreate,
}: {
  base: string
  /** Every post the person can see; filtering happens here, in the browser. */
  posts: PostRow[]
  status: Filter
  q: string
  canCreate: boolean
}) {
  const [status, setStatusState] = useState<Filter>(initialStatus)
  const [query, setQueryState] = useState(initialQuery)
  const q = query.trim().toLowerCase()

  /* The address keeps the filter (so a reload or a shared link shows the same) without asking the server for anything. */
  const remember = (key: 'status' | 'q', value: string) => {
    const url = new URL(window.location.href)
    if (value) url.searchParams.set(key, value)
    else url.searchParams.delete(key)
    window.history.replaceState(window.history.state, '', url)
  }
  const setStatus = (s: Filter) => {
    setStatusState(s)
    remember('status', s === 'all' ? '' : s)
  }
  const setQuery = (value: string) => {
    setQueryState(value)
    remember('q', value.trim().slice(0, 100))
  }

  /* Same match as the server's search: title, address or category contains the text. */
  const matching = useMemo(() => (q ? all.filter((p) => [p.title, p.slug, p.category ?? ''].some((f) => f.toLowerCase().includes(q))) : all), [all, q])
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: matching.length, draft: 0, review: 0, scheduled: 0, published: 0 }
    for (const p of matching) c[p.status]++
    return c
  }, [matching])
  const posts = status === 'all' ? matching : matching.filter((p) => p.status === status)

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="-mx-1 overflow-x-auto px-1 scrollbar-none">
          <Segmented<Filter>
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: 'All', count: counts.all },
              { value: 'draft', label: 'Drafts', count: counts.draft },
              { value: 'review', label: 'In review', count: counts.review },
              { value: 'scheduled', label: 'Scheduled', count: counts.scheduled },
              { value: 'published', label: 'Published', count: counts.published },
            ]}
          />
        </div>
        <label className="relative flex h-10 w-full items-center md:w-72">
          <MagnifyingGlass size={16} className="pointer-events-none absolute left-3.5 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search titles, categories…"
            aria-label="Search posts"
            className="h-full w-full rounded-full bg-surface pl-10 pr-9 text-sm text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] placeholder:text-faint focus:outline-none focus:shadow-[inset_0_0_0_1.5px_var(--brand),var(--ring)]"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-2 grid size-6 place-items-center rounded-full text-muted hover:bg-sunken" aria-label="Clear search">
              <X size={12} />
            </button>
          )}
        </label>
      </div>

      <div className="mt-6">
        {posts.length === 0 ? (
          <EmptyState
            title={q ? 'Nothing matches' : status === 'all' ? 'No posts yet' : `No ${status === 'review' ? 'posts in review' : `${status} posts`}`}
            body={q ? `No post title, address or category contains “${query.trim()}”.` : 'Posts you write show up here, newest edit first.'}
            art={<NotePencil size={40} weight="thin" />}
            action={
              canCreate && !q ? (
                <Button asChild variant="brand">
                  <Link href={`${base}/posts/new`} prefetch>Write a post</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="overflow-hidden rounded-[22px] border border-line bg-surface shadow-card">
            <AnimatePresence initial={false} mode="popLayout">
              {posts.map((p, i) => (
                <motion.li
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 12) * 0.025 } }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="border-b border-line last:border-b-0"
                >
                  <Link href={`${base}/posts/${p.id}`} {...prefetchOnHover} className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-surface-2 sm:px-5">
                    <Thumb src={p.cover} title={p.title} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[15px] font-medium text-ink transition-colors group-hover:text-ink">{p.title}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 truncate text-[12.5px] text-muted">
                        {p.category && <span>{p.category}</span>}
                        {p.category && <span className="text-faint">·</span>}
                        <span>{p.readingMinutes} min read</span>
                        {p.status === 'scheduled' && p.publishedAt && (
                          <>
                            <span className="text-faint">·</span>
                            <span className="text-info">goes live <TimeAgo date={p.publishedAt} /></span>
                          </>
                        )}
                      </div>
                    </div>
                    {p.author && (
                      <span className="hidden items-center gap-2 text-[13px] text-ink-2 md:flex">
                        <Avatar name={p.author} size={24} />
                        <span className="max-w-[120px] truncate">{p.author}</span>
                      </span>
                    )}
                    <LinkPending className="text-muted" />
                    <StatusPill status={p.status} className="hidden sm:inline-flex" />
                    <span className="hidden w-24 shrink-0 text-right text-[12px] text-faint lg:block"><TimeAgo date={p.updatedAt} /></span>
                  </Link>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  )
}

function Thumb({ src, title }: { src: string | null; title: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className="h-12 w-16 shrink-0 rounded-xl object-cover transition-transform duration-500 group-hover:scale-105" />
  }
  return (
    <span className="grid h-12 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-brand-soft font-serif text-xl text-ink/70 transition-transform duration-500 group-hover:scale-105">
      {title.slice(0, 1)}
    </span>
  )
}
