'use client'

import { useRef } from 'react'
import Link from 'next/link'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { ArrowUpRight } from '@phosphor-icons/react'
import type { PostSummary } from '@cms/site-kit'
import { Cover } from '../components/cover'
import { Container } from '../components/container'

gsap.registerPlugin(ScrollTrigger, useGSAP)

/**
 * Scroll pinning: the heading holds still on the left while the newest posts from
 * the CMS travel up on the right, each picture growing in as it arrives and
 * dimming as it leaves.
 */
export function JournalPin({ posts, blogTitle, blogUrl }: { posts: PostSummary[]; blogTitle: string; blogUrl: string }) {
  const root = useRef<HTMLElement>(null)
  useGSAP(
    () => {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
      const mm = gsap.matchMedia()
      mm.add('(min-width: 1024px)', () => {
        ScrollTrigger.create({ trigger: root.current, start: 'top top+=120', end: 'bottom bottom', pin: '[data-pin]', pinSpacing: false })
      })
      gsap.utils.toArray<HTMLElement>('[data-card]').forEach((card) => {
        const img = card.querySelector('[data-img]')
        gsap.fromTo(img, { scale: 0.8 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: card, start: 'top bottom', end: 'top 35%', scrub: true } })
        gsap.to(card, { opacity: 0.2, ease: 'none', scrollTrigger: { trigger: card, start: 'bottom 30%', end: 'bottom top', scrub: true } })
      })
      return () => mm.revert()
    },
    { scope: root, dependencies: [posts.length] }
  )
  if (!posts.length) return null
  return (
    <section ref={root} className="relative bg-paper-2 py-32 md:py-48">
      <Container className="grid gap-16 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <div data-pin className="lg:pt-4">
            <p className="text-[15px] font-semibold text-mute">{blogTitle}</p>
            <h2 className="mt-4 font-display text-[clamp(2.75rem,5.5vw,5.5rem)] font-bold leading-[0.92] tracking-[-0.05em]">
              Notes from the <span className="text-accent">desk</span>, written as we work.
            </h2>
            <p className="mt-6 max-w-sm text-[18px] leading-relaxed text-ink-2">Guides, case notes and the occasional opinion. Published from our CMS, live here within a minute.</p>
            <Link href={blogUrl} className="group mt-10 inline-flex items-center gap-3 text-[17px] font-semibold">
              <span className="grid size-12 place-items-center rounded-full bg-ink text-paper transition-transform duration-500 group-hover:rotate-45 group-hover:bg-accent group-hover:text-accent-ink">
                <ArrowUpRight size={18} weight="bold" />
              </span>
              Everything in the {blogTitle.toLowerCase()}
            </Link>
          </div>
        </div>
        <ul className="flex flex-col gap-20">
          {posts.map((p) => (
            <li key={p.id} data-card>
              <Link href={p.url} className="group block">
                <div className="aspect-[4/3] overflow-hidden rounded-[28px] bg-ink">
                  <div data-img className="h-full w-full origin-bottom transition-transform duration-700 ease-out-expo group-hover:scale-105">
                    <Cover cover={p.cover} title={p.title} category={p.category} sizes="(min-width: 1024px) 55vw, 100vw" />
                  </div>
                </div>
                <div className="mt-6 flex items-center gap-3 text-[14px] text-mute">
                  {p.category && <span className="rounded-full border border-rule px-3 py-1 font-medium text-ink-2">{p.category}</span>}
                  <span>{p.dateLabel}</span>
                  <span>·</span>
                  <span>{p.readingMinutes} min read</span>
                </div>
                <h3 className="mt-3 font-display text-[clamp(1.75rem,2.6vw,2.6rem)] font-bold leading-[1.02] tracking-[-0.035em] transition-colors group-hover:text-accent">{p.title}</h3>
                {p.excerpt && <p className="mt-3 max-w-xl text-[17px] leading-relaxed text-ink-2">{p.excerpt}</p>}
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
