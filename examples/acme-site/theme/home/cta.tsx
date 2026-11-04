import Link from 'next/link'
import { ArrowUpRight } from '@phosphor-icons/react/dist/ssr'
import { Container } from '../components/container'

/** The last ask before the footer: huge type, one button. */
export function BigCta({ heading, body, label, href }: { heading: string; body: string; label: string; href: string }) {
  return (
    <section className="relative overflow-hidden bg-accent py-32 text-accent-ink md:py-48">
      <div className="grain absolute inset-0" />
      <Container className="relative">
        <h2 className="max-w-6xl font-display text-[clamp(3rem,8vw,8.5rem)] font-extrabold leading-[0.86] tracking-[-0.06em]">{heading}</h2>
        <div className="mt-12 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <p className="max-w-lg text-[19px] leading-relaxed opacity-80">{body}</p>
          <Link href={href} className="group inline-flex items-center gap-3 self-start rounded-full bg-ink py-4 pl-8 pr-4 text-[18px] font-semibold text-paper transition-transform hover:scale-[1.03]">
            {label}
            <span className="grid size-10 place-items-center rounded-full bg-paper text-ink transition-transform duration-500 group-hover:rotate-45">
              <ArrowUpRight size={18} weight="bold" />
            </span>
          </Link>
        </div>
      </Container>
    </section>
  )
}
