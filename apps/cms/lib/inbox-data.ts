import 'server-only'
import type { Access } from '@/lib/auth/access'
import { countUnread, listMessages, type ContactMessage, type InboxFilter } from '@/lib/content/contact'
import { readWorkspace } from '@/lib/db'

/** What the message list needs: small enough to send to the browser, which filters and searches it. */
export type InboxItem = Pick<ContactMessage, 'id' | 'name' | 'email' | 'company' | 'topic' | 'message' | 'receivedAt' | 'readAt' | 'archived'>

const item = (m: ContactMessage): InboxItem => ({
  id: m.id,
  name: m.name,
  email: m.email,
  company: m.company,
  topic: m.topic,
  message: m.message,
  receivedAt: m.receivedAt,
  readAt: m.readAt,
  archived: m.archived,
})

/**
 * The inbox and the archive (the newest 500 of each), the open message and the
 * unread count, read at once. The filter tabs and search box work in the browser.
 */
export async function inboxData(access: Access, sp: { filter?: string; q?: string }, loadSelected?: () => Promise<ContactMessage>) {
  const filter: InboxFilter = sp.filter === 'unread' || sp.filter === 'archived' ? sp.filter : 'inbox'
  const q = typeof sp.q === 'string' ? sp.q.slice(0, 100) : ''
  const wsId = access.workspace.id
  /* The open message is loaded by its own (cached) lookup, outside this read: on
     Postgres a read is a transaction, and one must never wait on another. */
  const [lists, selected] = await Promise.all([
    readWorkspace(wsId, (tx) => Promise.all([listMessages(tx, wsId, 'inbox'), listMessages(tx, wsId, 'archived'), countUnread(tx, wsId)])),
    loadSelected ? loadSelected() : null,
  ])
  const [inbox, archived, unread] = lists
  return { filter, q, items: [...inbox, ...archived].map(item), selected, counts: { unread } }
}
