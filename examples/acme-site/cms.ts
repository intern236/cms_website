import 'server-only'
import { createCms } from '@cms/site-kit'

/** The one connection to the CMS. Everything on this site reads through it. */
export const cms = createCms({
  url: process.env.CMS_URL ?? '',
  key: process.env.CMS_SITE_KEY ?? '',
  siteUrl: process.env.SITE_URL,
  revalidate: 60,
})
