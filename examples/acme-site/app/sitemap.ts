import type { MetadataRoute } from 'next'
import { sitemapEntries } from '@cms/site-kit/next'
import { cms } from '@/cms'
import { STATIC_PAGES } from '@/theme/nav-links'

export const revalidate = 300

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return sitemapEntries(cms, STATIC_PAGES)
}
