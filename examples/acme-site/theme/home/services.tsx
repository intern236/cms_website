'use client'

import { useState } from 'react'
import { ArrowUpRight } from '@phosphor-icons/react'
import { Reveal, SplitWords } from '../motion/reveal'
import { Container } from '../components/container'

const SERVICES = [
  { title: 'Strategy', seed: 'whiteboard-plan', body: 'A week of questions before a single pixel moves. We leave with a map of the site and a list of decisions.' },
  { title: 'Writing', seed: 'notebook-ink', body: 'Real headlines, honest pages, and words your customers already use when they search.' },
  { title: 'Design', seed: 'paper-swatches', body: 'Type, space and colour that make the content easy to read — and the business easy to trust.' },
  { title: 'Care', seed: 'workshop-tools', body: 'A CMS your team can use without calling us, and a call when you want one.' },
]

/**
 * Horizontal accordion: four slices, the one you point at opens wide to show
 * its picture and paragraph. On phones it becomes a simple stack.
 */
export function Services() {
  const [open, setOpen] = useState(0)
  return (
    <section id="services" className="py-32 md:py-48">
      <Container>
        <Reveal className="mb-16 grid gap-6 md:grid-cols-[1.3fr_1fr] md:items-end">
          <h2 data-reveal className="font-display text-[clamp(2.5rem,5vw,4.75rem)] font-bold leading-[0.95] tracking-[-0.045em]">
            <SplitWords text="Four things, done properly." onScroll />
          </h2>
          <p data-reveal className="max-w-md text-[18px] leading-relaxed text-ink-2">
            We keep the list short on purpose. Every project gets all four, by the same small team, from the first call to long after launch.
          </p>
        </Reveal>
        <div className="flex h-auto flex-col gap-3 md:h-[560px] md:flex-row" onMouseLeave={() => setOpen(0)}>
          {SERVICES.map((s, i) => {
            const active = open === i
            return (
              <article
                key={s.title}
                onMouseEnter={() => setOpen(i)}
                onFocus={() => setOpen(i)}
                tabIndex={0}
                className={`group relative min-h-[280px] overflow-hidden rounded-[28px] bg-ink text-paper transition-[flex-grow] duration-700 ease-out-expo md:min-h-0 ${active ? 'md:flex-[4]' : 'md:flex-[1]'}`}
              >
                <div
                  className={`absolute inset-0 bg-cover bg-center grayscale transition-all duration-1000 ease-out-expo ${active ? 'scale-100 opacity-60' : 'scale-110 opacity-25'}`}
                  style={{ backgroundImage: `url(https://picsum.photos/seed/${s.seed}/1200/900)` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
                <div className="relative flex h-full flex-col justify-between p-7">
                  <span aria-hidden className={`size-2.5 rounded-full transition-colors duration-500 ${active ? 'bg-accent' : 'bg-paper/30'}`} />
                  <div>
                    <h3 className={`font-display font-bold tracking-[-0.04em] transition-all duration-700 ${active ? 'text-[clamp(2.5rem,4vw,4rem)]' : 'text-[clamp(1.75rem,2.4vw,2.25rem)] md:[writing-mode:vertical-rl] md:rotate-180'}`}>
                      {s.title}
                    </h3>
                    <div className={`grid transition-all duration-700 ease-out-expo ${active ? 'mt-4 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 md:mt-0'}`}>
                      <div className="overflow-hidden">
                        <p className="max-w-md text-[17px] leading-relaxed text-paper/75">{s.body}</p>
                        <span className="mt-6 inline-flex size-12 items-center justify-center rounded-full bg-accent text-accent-ink">
                          <ArrowUpRight size={20} weight="bold" />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </Container>
    </section>
  )
}
