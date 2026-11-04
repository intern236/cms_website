import Link from 'next/link'
import type { AuthorRef } from '@cms/site-kit'
import { Avatar } from '../blog/post-card'

export function AuthorTile({ author }: { author: AuthorRef }) {
  return (
    <Link href={author.url ?? '#'} data-reveal className="group flex flex-col rounded-[28px] bg-paper-2 p-8 transition duration-500 ease-out-expo hover:-translate-y-1.5 hover:bg-ink hover:text-paper">
      <Avatar author={author} size={88} />
      <h2 className="mt-8 font-display text-[34px] font-bold leading-none tracking-[-0.04em]">{author.name}</h2>
      {author.role && <p className="mt-2 text-[16px] opacity-60">{author.role}</p>}
      {author.bio && <p className="mt-5 line-clamp-3 text-[16px] leading-relaxed opacity-80">{author.bio}</p>}
      <p className="mt-auto pt-8 text-[14px] font-semibold">
        {author.postCount} {author.postCount === 1 ? 'article' : 'articles'} <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
      </p>
    </Link>
  )
}
