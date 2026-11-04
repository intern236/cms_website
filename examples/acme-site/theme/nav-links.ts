import type { Site } from '@cms/site-kit'

/** The site's own pages, plus the CMS-driven ones that are switched on. */
export function navLinks(site: Site) {
  return [
    { label: 'Work', href: '/#services' },
    { label: site.blog.title, href: site.blog.basePath },
    ...(site.blog.authors ? [{ label: 'People', href: '/authors' }] : []),
  ]
}

export const STATIC_PAGES = ['/', '/contact']
