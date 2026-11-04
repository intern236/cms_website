import Link from 'next/link'
import type { PostSummary } from '@cms/site-kit'
import { Cover } from '../components/cover'

/** One post in a grid. `feature` makes it the big one. */
export function PostCard({ post, feature = false }: { post: PostSummary; feature?: boolean }) {
  return (
    <Link href={post.url} data-reveal className={`group flex flex-col ${feature ? 'md:col-span-2 md:row-span-2' : ''}`}>
      <div className={`overflow-hidden rounded-[24px] bg-ink ${feature ? 'aspect-[4/3] md:aspect-auto md:min-h-[420px] md:flex-1' : 'aspect-[4/3]'}`}>
        <div className="h-full w-full transition-transform duration-700 ease-out-expo group-hover:scale-105">
          <Cover cover={post.cover} title={post.title} category={post.category} sizes={feature ? '(min-width: 768px) 66vw, 100vw' : '(min-width: 768px) 33vw, 100vw'} eager={feature} />
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-mute">
        {post.category && <span className="font-semibold text-ink-2">{post.category}</span>}
        <time dateTime={post.publishedAt.toISOString()}>{post.dateLabel}</time>
        <span aria-hidden>·</span>
        <span>{post.readingMinutes} min</span>
      </div>
      <h3 className={`mt-2 font-display font-bold tracking-[-0.035em] transition-colors group-hover:text-accent ${feature ? 'text-[clamp(2rem,3.4vw,3.25rem)] leading-[0.98]' : 'text-[24px] leading-[1.08]'}`}>
        {post.title}
      </h3>
      {post.excerpt && <p className={`mt-3 leading-relaxed text-ink-2 ${feature ? 'max-w-2xl text-[18px]' : 'line-clamp-3 text-[16px]'}`}>{post.excerpt}</p>}
      {post.author && (
        <span className="mt-4 flex items-center gap-2 text-[14px] text-mute">
          <Avatar author={post.author} size={26} />
          {post.author.name}
        </span>
      )}
    </Link>
  )
}

export function Avatar({ author, size = 40 }: { author: { name: string; avatar: { src: string; alt: string } | null }; size?: number }) {
  if (author.avatar) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={author.avatar.src} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  }
  const initials = author.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  return (
    <span className="grid shrink-0 place-items-center rounded-full bg-ink font-semibold text-paper" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden>
      {initials}
    </span>
  )
}
