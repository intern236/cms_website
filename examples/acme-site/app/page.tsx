import { cms } from '@/cms'
import { BigCta } from '@/theme/home/cta'
import { Hero } from '@/theme/home/hero'
import { JournalPin } from '@/theme/home/journal'
import { Process } from '@/theme/home/process'
import { Services } from '@/theme/home/services'
import { Testimonials } from '@/theme/home/testimonials'

export const revalidate = 60

export default async function Home() {
  const [site, latest] = await Promise.all([cms.site(), cms.latest(3)])
  const cta = site.cta ?? { heading: 'Have a project in mind?', body: 'Tell us what you are building.', label: 'Get in touch', href: '/contact' }
  return (
    <>
      <Hero />
      <Services />
      <JournalPin posts={latest} blogTitle={site.blog.title} blogUrl={site.blog.basePath} />
      <Process />
      <Testimonials />
      <BigCta heading={cta.heading} body={cta.body} label={cta.label} href={cta.href} />
    </>
  )
}
