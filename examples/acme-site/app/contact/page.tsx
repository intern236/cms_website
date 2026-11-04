import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { pageMetadata } from '@cms/site-kit/next'
import { cms } from '@/cms'
import { Container } from '@/theme/components/container'
import { ContactForm } from '@/theme/components/contact-form'
import { SplitWords } from '@/theme/motion/reveal'

export const revalidate = 60

export async function generateMetadata(): Promise<Metadata> {
  const site = await cms.site()
  return pageMetadata(site, { title: 'Contact', description: `Start a project with ${site.name}. We reply within one working day.`, path: '/contact' })
}

export default async function Contact() {
  const site = await cms.site()
  if (!site.contact.enabled) notFound()
  return (
    <Container className="grid gap-16 pb-40 pt-40 lg:grid-cols-[0.9fr_1.1fr] lg:pt-52">
      <div>
        <h1 className="font-display text-[clamp(3rem,7vw,7rem)] font-extrabold leading-[0.88] tracking-[-0.06em]">
          <SplitWords text="Tell us what you are building." />
        </h1>
        <p className="mt-8 max-w-md text-[19px] leading-relaxed text-ink-2">A real person reads every message and replies within one working day. No forms-to-forms, no sales sequence.</p>
      </div>
      <ContactForm topics={site.contact.topics} />
    </Container>
  )
}
