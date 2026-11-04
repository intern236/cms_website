import type { MetadataRoute } from 'next'
import { cms } from '@/cms'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const site = await cms.site()
  return { rules: [{ userAgent: '*', allow: '/', disallow: ['/preview', '/api/'] }], sitemap: `${site.url}/sitemap.xml` }
}
