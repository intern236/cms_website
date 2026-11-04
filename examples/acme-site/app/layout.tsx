import type { Metadata } from 'next'
import { rootMetadata } from '@cms/site-kit/next'
import { OrganizationSchema } from '@cms/site-kit/ui'
import { cms } from '@/cms'
import { Footer } from '@/theme/components/footer'
import { Nav } from '@/theme/components/nav'
import { cabinet, newsreader } from '@/theme/fonts'
import { SmoothScroll } from '@/theme/motion/smooth-scroll'
import { navLinks } from '@/theme/nav-links'
import './globals.css'

export const revalidate = 60

export async function generateMetadata(): Promise<Metadata> {
  return rootMetadata(await cms.site())
}

function readableOn(hex: string) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return '#0e0e0c'
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return 1.05 / (L + 0.05) >= (L + 0.05) / 0.05 ? '#ffffff' : '#0e0e0c'
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const site = await cms.site()
  const links = navLinks(site)
  return (
    <html
      lang={site.language}
      className={`${cabinet.variable} ${newsreader.variable}`}
      style={{ ['--accent' as string]: site.accent, ['--accent-ink' as string]: readableOn(site.accent) }}
    >
      <body className="overflow-x-hidden">
        <SmoothScroll />
        <OrganizationSchema site={site} />
        <Nav name={site.name} logoUrl={site.logoUrl} links={links} />
        <main className="w-full max-w-full overflow-x-hidden">{children}</main>
        <Footer site={site} links={links} />
      </body>
    </html>
  )
}
