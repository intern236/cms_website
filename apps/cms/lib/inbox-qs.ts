import type { InboxFilter } from '@/lib/content/contact'

/** The query string that carries the inbox filter and search into an address (server and browser). */
export function inboxQs(filter: InboxFilter, q: string) {
  const s = new URLSearchParams({ ...(filter !== 'inbox' ? { filter } : {}), ...(q ? { q } : {}) }).toString()
  return s ? `?${s}` : ''
}
