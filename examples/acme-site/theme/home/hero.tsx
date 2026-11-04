'use client'

import { useRef } from 'react'
import Link from 'next/link'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { ArrowDown, ArrowUpRight } from '@phosphor-icons/react'

gsap.registerPlugin(ScrollTrigger, useGSAP)

/**
 * Cinematic centre: a full-bleed photograph under a dark radial wash, the headline
 * set wide across two lines with small images living inside it, two calls to
 * action. On scroll the photo drifts and the type lifts away.
 */
export function Hero() {
  const root = useRef<HTMLElement>(null)
  useGSAP(
    () => {
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } })
      if (!reduce) {
        tl.from('[data-bg]', { scale: 1.25, duration: 2.4 }, 0)
          .from('[data-word]', { yPercent: 115, rotate: 4, duration: 1.4, stagger: 0.05 }, 0.2)
          .from('[data-pill]', { width: 0, opacity: 0, duration: 1.2, stagger: 0.15 }, 0.6)
          .from('[data-fade]', { y: 24, opacity: 0, duration: 1.2, stagger: 0.1 }, 0.8)
        gsap.to('[data-bg]', { yPercent: 18, scale: 1.08, ease: 'none', scrollTrigger: { trigger: root.current, start: 'top top', end: 'bottom top', scrub: true } })
        gsap.to('[data-copy]', { yPercent: -30, opacity: 0, ease: 'none', scrollTrigger: { trigger: root.current, start: 'top top', end: 'bottom top', scrub: true } })
      }
    },
    { scope: root }
  )

  return (
    <section ref={root} className="relative isolate flex min-h-[100svh] items-center justify-center overflow-hidden bg-ink text-paper">
      <div data-bg className="absolute inset-0 -z-20 bg-cover bg-center opacity-70 grayscale contrast-125" style={{ backgroundImage: 'url(https://picsum.photos/seed/studio-desk/1920/1080)' }} />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(14,14,12,0.35)_0%,rgba(14,14,12,0.85)_60%,#0e0e0c_100%)]" />
      <div className="grain absolute inset-0 -z-10" />
      <div data-copy className="mx-auto w-full max-w-6xl px-5 pt-24 text-center sm:px-8">
        <h1 className="font-display text-[clamp(2.75rem,5.4vw,5.75rem)] font-bold leading-[0.95] tracking-[-0.045em]">
          <W>We</W> <W>build</W> <W>websites</W> <Pill seed="type-hero" /> <W>people</W>
          <br className="hidden md:block" /> <W>actually</W> <W>finish</W> <W>reading.</W>
          <Pill seed="ink-light" />
        </h1>
        <p data-fade className="mx-auto mt-8 max-w-2xl text-[clamp(1.05rem,1rem+0.4vw,1.3rem)] leading-relaxed text-paper/70">
          Acme is a small studio that plans, writes and designs websites for independent businesses — and keeps them easy to update long after launch.
        </p>
        <div data-fade className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/contact" className="group inline-flex items-center gap-2 rounded-full bg-paper py-3.5 pl-6 pr-3 text-[16px] font-semibold text-ink transition-transform hover:scale-[1.03]">
            Start a project
            <span className="grid size-8 place-items-center rounded-full bg-accent text-accent-ink transition-transform duration-500 group-hover:rotate-45">
              <ArrowUpRight size={16} weight="bold" />
            </span>
          </Link>
          <Link href="/blog" className="inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3.5 text-[16px] font-semibold text-paper backdrop-blur transition hover:bg-white/10">
            Read the journal
          </Link>
        </div>
      </div>
      <div data-fade className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-[12px] text-paper/50">
        <span className="grid size-10 place-items-center rounded-full border border-white/20">
          <ArrowDown size={14} className="animate-bounce" />
        </span>
      </div>
    </section>
  )
}

/** One word that rises out of its own mask. */
function W({ children }: { children: string }) {
  return (
    <span className="inline-block overflow-hidden pb-[0.08em] align-top">
      <span data-word className="inline-block">
        {children}
      </span>
    </span>
  )
}

/** A small photo set inside the headline. */
function Pill({ seed }: { seed: string }) {
  return (
    <span
      data-pill
      aria-hidden
      className="mx-[0.12em] inline-block h-[0.78em] w-[1.9em] translate-y-[0.06em] rounded-full bg-cover bg-center align-baseline grayscale-[30%] ring-1 ring-white/20"
      style={{ backgroundImage: `url(https://picsum.photos/seed/${seed}/400/200)` }}
    />
  )
}
