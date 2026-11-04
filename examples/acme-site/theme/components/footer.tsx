import Link from 'next/link'
import type { Site } from '@cms/site-kit'
import { Container } from './container'
import { SocialIcon } from './social'

export function Footer({ site, links }: { site: Site; links: { label: string; href: string }[] }) {
  return (
    <footer className="relative overflow-hidden bg-ink pt-24 text-paper">
      <Container>
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="max-w-sm text-[17px] leading-relaxed text-paper/60">{site.description}</p>
            <div className="mt-6 flex gap-2">
              {site.social.map((s) => (
                <a key={s.url} href={s.url} target="_blank" rel="noreferrer" aria-label={s.platform} className="grid size-11 place-items-center rounded-full border border-white/15 text-paper/80 transition hover:-translate-y-0.5 hover:border-accent hover:text-accent">
                  <SocialIcon platform={s.platform} />
                </a>
              ))}
            </div>
          </div>
          <nav aria-label="Footer">
            <p className="mb-4 text-[13px] text-paper/40">Explore</p>
            <ul className="space-y-2.5 text-[17px]">
              {[{ label: 'Home', href: '/' }, ...links, { label: 'Contact', href: '/contact' }].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-paper/80 transition hover:text-accent">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div>
            <p className="mb-4 text-[13px] text-paper/40">Subscribe</p>
            <a href="/feed.xml" className="text-[17px] text-paper/80 transition hover:text-accent">
              RSS feed
            </a>
          </div>
        </div>
      </Container>
      <div aria-hidden className="mt-20 select-none whitespace-nowrap text-center font-display text-[22vw] font-extrabold leading-[0.78] tracking-[-0.07em] text-paper/[0.06]">
        {site.name.split(' ')[0]}
      </div>
      <Container className="flex flex-col gap-2 border-t border-white/10 py-6 text-[13px] text-paper/40 sm:flex-row sm:justify-between">
        <span>
          © {new Date().getFullYear()} {site.legalName || site.name}
        </span>
        <span>Content managed with your agency&apos;s CMS</span>
      </Container>
    </footer>
  )
}
