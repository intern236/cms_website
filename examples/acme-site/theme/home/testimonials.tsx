'use client'

import { useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ArrowLeft, ArrowRight } from '@phosphor-icons/react'
import { Container } from '../components/container'

gsap.registerPlugin(useGSAP)

const QUOTES = [
  { quote: 'They cut our site in half and doubled the enquiries. I still do not fully understand how, and I no longer care.', name: 'Meera Iyer', role: 'Founder, Iyer & Daughters', seed: 'portrait-meera' },
  { quote: 'The first agency that asked what our customers actually search for. The CMS is the first one our team has not been scared of.', name: 'James Okafor', role: 'Director, Okafor Joinery', seed: 'portrait-james' },
  { quote: 'Launch week was the calmest of my career. Everything was written, approved and already in the CMS.', name: 'Lena Fischer', role: 'Owner, Fischer Physio', seed: 'portrait-lena' },
]

/** Overlapping portraits on one side, the quote on the other; arrows move through them. */
export function Testimonials() {
  const [i, setI] = useState(0)
  const q = QUOTES[i]
  useGSAP(
    () => {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
      gsap.from('[data-quote] [data-line]', { yPercent: 100, opacity: 0, duration: 0.9, ease: 'expo.out', stagger: 0.05 })
    },
    { dependencies: [i] }
  )
  return (
    <section className="bg-ink py-32 text-paper md:py-48">
      <Container className="grid items-center gap-16 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="relative mx-auto h-[360px] w-full max-w-[420px]">
          {QUOTES.map((t, j) => {
            const offset = (j - i + QUOTES.length) % QUOTES.length
            return (
              <div
                key={t.name}
                className="absolute left-1/2 top-1/2 h-[300px] w-[230px] overflow-hidden rounded-[28px] bg-cover bg-center shadow-2xl transition-all duration-700 ease-out-expo"
                style={{
                  backgroundImage: `url(https://picsum.photos/seed/${t.seed}/500/650)`,
                  transform: `translate(-50%, -50%) translateX(${offset * 70 - 70}px) rotate(${(offset - 1) * 7}deg) scale(${offset === 0 ? 1 : 0.86})`,
                  zIndex: 10 - offset,
                  filter: offset === 0 ? 'grayscale(0)' : 'grayscale(1) brightness(0.6)',
                }}
              />
            )
          })}
        </div>
        <div>
          <blockquote data-quote key={i} className="font-display text-[clamp(1.75rem,3.2vw,3rem)] font-semibold leading-[1.08] tracking-[-0.035em]">
            {q.quote.split('. ').map((line, n, all) => (
              <span key={n} className="block overflow-hidden">
                <span data-line className="block">
                  {line}
                  {n < all.length - 1 ? '.' : ''}
                </span>
              </span>
            ))}
          </blockquote>
          <div className="mt-10 flex items-center justify-between gap-6">
            <p>
              <span className="block text-[18px] font-semibold">{q.name}</span>
              <span className="text-[15px] text-paper/55">{q.role}</span>
            </p>
            <div className="flex gap-2">
              <button onClick={() => setI((i - 1 + QUOTES.length) % QUOTES.length)} aria-label="Previous" className="grid size-12 place-items-center rounded-full border border-white/20 transition hover:bg-white/10">
                <ArrowLeft size={18} />
              </button>
              <button onClick={() => setI((i + 1) % QUOTES.length)} aria-label="Next" className="grid size-12 place-items-center rounded-full bg-accent text-accent-ink transition hover:scale-105">
                <ArrowRight size={18} weight="bold" />
              </button>
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}
