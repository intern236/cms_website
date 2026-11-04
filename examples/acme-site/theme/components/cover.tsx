import type { CoverRef } from '@cms/site-kit'

/**
 * A post's picture. With no uploaded cover, a typographic poster is drawn from the
 * title and category instead, so every card still has something worth looking at.
 */
export function Cover({
  cover,
  title,
  category,
  className = '',
  sizes = '(min-width: 1024px) 50vw, 100vw',
  eager,
}: {
  cover: CoverRef | null
  title: string
  category: string | null
  className?: string
  sizes?: string
  eager?: boolean
}) {
  if (cover) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={cover.src}
        srcSet={cover.srcSet}
        sizes={sizes}
        alt={cover.alt}
        loading={eager ? 'eager' : 'lazy'}
        className={`h-full w-full object-cover ${className}`}
      />
    )
  }
  const hue = [...title].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)
  return (
    <div
      role="img"
      aria-label={title}
      className={`grain relative flex h-full w-full flex-col justify-between overflow-hidden p-[6%] text-paper ${className}`}
      style={{ background: `linear-gradient(140deg, color-mix(in oklab, var(--accent) 92%, black), color-mix(in oklab, var(--accent) 35%, oklch(0.25 0.05 ${hue})))` }}
    >
      <div className="absolute -right-[15%] -top-[25%] aspect-square w-[70%] rounded-full bg-paper/15 blur-2xl" />
      <span className="relative text-[clamp(11px,1.1vw,14px)] font-semibold tracking-[0.02em] text-paper/80">{category ?? 'Journal'}</span>
      <span className="relative font-display text-[clamp(64px,14vw,220px)] font-extrabold leading-[0.75] tracking-[-0.08em] text-paper/90">{title.replace(/[^A-Za-z0-9]/g, '').slice(0, 1) || '·'}</span>
    </div>
  )
}
