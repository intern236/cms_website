'use client'

import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger, useGSAP)

/** Children marked `data-reveal` rise and fade in as they scroll into view, one after another. */
export function Reveal({ children, className, as: Tag = 'div', stagger = 0.08 }: { children: React.ReactNode; className?: string; as?: 'div' | 'section' | 'ul' | 'header'; stagger?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useGSAP(
    () => {
      const items = ref.current?.querySelectorAll('[data-reveal]')
      if (!items?.length) return
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
      gsap.from(items, {
        y: 40,
        opacity: 0,
        duration: 1.1,
        ease: 'expo.out',
        stagger,
        scrollTrigger: { trigger: ref.current, start: 'top 85%', once: true },
      })
    },
    { scope: ref }
  )
  return (
    // @ts-expect-error -- polymorphic ref
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  )
}

/** A heading whose words slide up out of a mask, on load or on scroll. */
export function SplitWords({ text, className, onScroll = false, delay = 0 }: { text: string; className?: string; onScroll?: boolean; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  useGSAP(
    () => {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
      gsap.from(ref.current!.querySelectorAll('[data-word]'), {
        yPercent: 110,
        rotate: 3,
        duration: 1.2,
        ease: 'expo.out',
        stagger: 0.06,
        delay,
        ...(onScroll ? { scrollTrigger: { trigger: ref.current, start: 'top 85%', once: true } } : {}),
      })
    },
    { scope: ref }
  )
  return (
    <span ref={ref} className={className} aria-label={text}>
      {text.split(' ').map((w, i, all) => (
        <span key={i} aria-hidden className="inline-block overflow-hidden pb-[0.12em] align-top">
          <span data-word className="inline-block will-change-transform">
            {w}
            {i < all.length - 1 ? ' ' : ''}
          </span>
        </span>
      ))}
    </span>
  )
}
