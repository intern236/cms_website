'use client'

import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { Container } from '../components/container'
import { SplitWords } from '../motion/reveal'

gsap.registerPlugin(ScrollTrigger, useGSAP)

const STEPS = [
  { title: 'Listen', body: 'A week of questions. We learn the business, the customers and what the website is actually for.', seed: 'listen-cafe', tone: 'bg-paper text-ink' },
  { title: 'Write', body: 'Every headline and page drafted in plain words before design starts — so the design serves the content.', seed: 'typewriter-desk', tone: 'bg-ink text-paper' },
  { title: 'Design', body: 'Type, layout and motion built around the words. Prototypes you can click, not pictures of pages.', seed: 'design-grid', tone: 'bg-accent text-accent-ink' },
  { title: 'Hand over', body: 'Launch, a CMS your team understands, and a guide written for the people who will use it.', seed: 'keys-hand', tone: 'bg-paper-2 text-ink' },
]

/**
 * Card stacking: each step pins near the top and the next one slides up over it,
 * while the ones underneath shrink back into the pile.
 */
export function Process() {
  const root = useRef<HTMLElement>(null)
  useGSAP(
    () => {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
      const cards = gsap.utils.toArray<HTMLElement>('[data-step]')
      cards.forEach((card, i) => {
        if (i === cards.length - 1) return
        gsap.fromTo(card, { scale: 1, filter: 'brightness(1)' }, {
          scale: 0.9 + i * 0.02,
          filter: 'brightness(0.7)',
          ease: 'none',
          scrollTrigger: { trigger: cards[i + 1], start: 'top bottom', end: 'top 15%', scrub: true },
        })
      })
    },
    { scope: root }
  )
  return (
    <section ref={root} className="py-32 md:py-48">
      <Container>
        <h2 className="mb-20 max-w-4xl font-display text-[clamp(2.5rem,5vw,4.75rem)] font-bold leading-[0.95] tracking-[-0.045em]">
          <SplitWords text="How a project actually runs." onScroll />
        </h2>
        <div className="flex flex-col gap-6">
          {STEPS.map((s, i) => (
            <article
              key={s.title}
              data-step
              className={`sticky grid min-h-[70vh] origin-top overflow-hidden rounded-[32px] md:grid-cols-2 ${s.tone}`}
              style={{ top: `calc(96px + ${i * 18}px)` }}
            >
              <div className="flex flex-col justify-between p-8 md:p-14">
                <span className="text-[15px] font-semibold opacity-60">Week {i * 2 + 1}{i < 3 ? `–${i * 2 + 2}` : '+'}</span>
                <div>
                  <h3 className="font-display text-[clamp(3rem,7vw,7rem)] font-extrabold leading-[0.85] tracking-[-0.06em]">{s.title}</h3>
                  <p className="mt-6 max-w-md text-[19px] leading-relaxed opacity-80">{s.body}</p>
                </div>
              </div>
              <div className="relative hidden overflow-hidden md:block">
                <div className="absolute inset-4 rounded-[24px] bg-cover bg-center grayscale contrast-110" style={{ backgroundImage: `url(https://picsum.photos/seed/${s.seed}/1200/1200)` }} />
              </div>
            </article>
          ))}
        </div>
      </Container>
    </section>
  )
}
