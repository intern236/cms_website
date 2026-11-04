'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ArrowUpRight, List, X } from '@phosphor-icons/react'

gsap.registerPlugin(useGSAP)

export type NavLink = { label: string; href: string }

/**
 * A floating glass pill. It tightens and darkens once you scroll, hides when you
 * scroll down a long way, and comes back the moment you scroll up.
 */
export function Nav({ name, logoUrl, links }: { name: string; logoUrl: string | null; links: NavLink[] }) {
  const path = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [open, setOpen] = useState(false)
  const overlay = useRef<HTMLDivElement>(null)
  const [lastPath, setLastPath] = useState(path)
  if (lastPath !== path) {
    setLastPath(path)
    setOpen(false)
  }

  useEffect(() => {
    let last = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      setScrolled(y > 24)
      setHidden(y > 600 && y > last + 4)
      if (y < last - 4) setHidden(false)
      last = y
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useGSAP(
    () => {
      if (!open || !overlay.current) return
      gsap.fromTo(overlay.current, { clipPath: 'circle(0% at 92% 4%)' }, { clipPath: 'circle(150% at 92% 4%)', duration: 0.9, ease: 'expo.inOut' })
      gsap.from(overlay.current.querySelectorAll('[data-item]'), { yPercent: 120, opacity: 0, stagger: 0.06, delay: 0.25, duration: 0.9, ease: 'expo.out' })
    },
    { dependencies: [open] }
  )

  /* Pages that open on a dark hero get a light-on-dark pill until you scroll. */
  const overDark = path === '/'
  const dark = scrolled || overDark
  const isActive = (href: string) => (href === '/' ? path === '/' : path.startsWith(href.split('#')[0]) && href !== '/')

  return (
    <>
      <header
        className={`fixed inset-x-0 top-3 z-50 flex justify-center px-3 transition-transform duration-500 ease-out-expo sm:top-5 ${hidden && !open ? '-translate-y-[140%]' : ''}`}
      >
        <nav
          aria-label="Main"
          className={`flex w-full max-w-[1100px] items-center justify-between gap-4 rounded-full border py-2 pl-3 pr-2 backdrop-blur-xl transition-all duration-500 ease-out-expo sm:pl-4 ${
            scrolled
              ? 'border-white/10 bg-ink/80 text-paper shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)]'
              : overDark
                ? 'border-white/15 bg-white/[0.07] text-paper'
                : 'border-ink/10 bg-paper/70 text-ink'
          }`}
        >
          <Link href="/" className="flex items-center gap-2.5 font-display text-[17px] font-bold tracking-[-0.03em]">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="size-8 rounded-full bg-white object-contain p-1" />
            ) : (
              <span className="grid size-8 place-items-center rounded-full bg-accent text-sm font-extrabold text-accent-ink">{name.slice(0, 1)}</span>
            )}
            {name}
          </Link>
          <ul className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={`relative rounded-full px-4 py-2 text-[14.5px] font-medium transition-colors ${
                    isActive(l.href) ? (dark ? 'bg-white/10' : 'bg-ink/5') : dark ? 'text-paper/70 hover:text-paper' : 'text-ink/65 hover:text-ink'
                  }`}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-1.5">
            <Link
              href="/contact"
              className="group hidden items-center gap-1.5 rounded-full bg-accent py-2 pl-4 pr-2 text-[14px] font-semibold text-accent-ink transition-transform hover:scale-[1.03] sm:flex"
            >
              Start a project
              <span className="grid size-7 place-items-center rounded-full bg-accent-ink/10 transition-transform duration-500 group-hover:rotate-45">
                <ArrowUpRight size={14} weight="bold" />
              </span>
            </Link>
            <button onClick={() => setOpen((o) => !o)} className="grid size-10 place-items-center rounded-full md:hidden" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}>
              {open ? <X size={20} /> : <List size={20} />}
            </button>
          </div>
        </nav>
      </header>
      {open && (
        <div ref={overlay} className="fixed inset-0 z-40 flex flex-col justify-end bg-ink px-6 pb-10 text-paper md:hidden">
          <ul className="flex flex-col gap-1">
            {[{ label: 'Home', href: '/' }, ...links, { label: 'Contact', href: '/contact' }].map((l) => (
              <li key={l.href} className="overflow-hidden">
                <Link data-item href={l.href} className="block font-display text-[15vw] font-bold leading-[1] tracking-[-0.05em]">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
