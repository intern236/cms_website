'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Archive, ArrowUUpLeft, EnvelopeSimple, EnvelopeSimpleOpen, MagnifyingGlass, Trash, Tray } from '@phosphor-icons/react'
import { removeMessage, setMessageState } from '@/lib/actions/content'
import { Button } from '@/components/ui/button'
import { Confirm } from '@/components/ui/confirm'
import { Avatar } from '@/components/ui/avatar'
import { LinkPending } from '@/components/ui/link-pending'
import { Tooltip } from '@/components/ui/misc'
import type { InboxFilter } from '@/lib/content/contact'
import type { InboxItem } from '@/lib/inbox-data'
import { inboxQs } from '@/lib/inbox-qs'
import { cn, relativeTime } from '@/lib/utils'
import { prefetchOnHover } from '@/lib/prefetch'

/** Opening a message marks it read, once. The action refreshes the page itself (revalidatePath), in the same round trip. */
export function MarkRead({ workspace, id, unread }: { workspace: string; id: string; unread: boolean }) {
  const done = useRef(false)
  useEffect(() => {
    if (!unread || done.current) return
    done.current = true
    void setMessageState(workspace, id, { read: true })
  }, [workspace, id, unread])
  return null
}

const FILTERS = ['inbox', 'unread', 'archived'] as const

/**
 * The message list. Filter tabs and search run here, in the browser, on the
 * messages the page already sent: switching costs no server trip.
 */
export function InboxList({
  base,
  items,
  filter: initialFilter,
  q: initialQuery,
  selectedId,
}: {
  base: string
  items: InboxItem[]
  filter: InboxFilter
  q: string
  selectedId: string | null
}) {
  const [filter, setFilterState] = useState<InboxFilter>(initialFilter)
  const [query, setQueryState] = useState(initialQuery)
  const q = query.trim().slice(0, 100)

  const remember = (f: InboxFilter, text: string) => {
    const url = new URL(window.location.href)
    url.search = inboxQs(f, text)
    window.history.replaceState(window.history.state, '', url)
  }
  const setFilter = (f: InboxFilter) => {
    setFilterState(f)
    remember(f, q)
  }
  const setQuery = (text: string) => {
    setQueryState(text)
    remember(filter, text.trim().slice(0, 100))
  }

  /* Same rules as the server: inbox = not archived; unread = not archived and unread;
     search matches name, email, company or message. */
  const needle = q.toLowerCase()
  const shown = items.filter((m) => {
    if (filter === 'archived' ? !m.archived : m.archived) return false
    if (filter === 'unread' && m.readAt) return false
    if (!needle) return true
    return [m.name, m.email, m.company ?? '', m.message].some((f) => f.toLowerCase().includes(needle))
  })
  const qs = inboxQs(filter, q)

  return (
    <>
      <div role="tablist" aria-label="Show" className="flex items-center gap-1 rounded-full bg-sunken p-1 text-[13px] font-medium">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={cn('flex-1 rounded-full py-1.5 text-center capitalize transition', filter === f ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink')}
          >
            {f}
          </button>
        ))}
      </div>
      <label className="relative flex h-10 items-center">
        <MagnifyingGlass size={16} className="pointer-events-none absolute left-3.5 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email, message…"
          aria-label="Search messages"
          className="h-full w-full rounded-full bg-surface pl-10 pr-4 text-sm shadow-[inset_0_0_0_1px_var(--line-strong)] placeholder:text-faint focus:outline-none focus:shadow-[inset_0_0_0_1.5px_var(--brand),var(--ring)]"
        />
      </label>
      <ul className="overflow-hidden rounded-[22px] border border-line bg-surface shadow-card">
        {shown.length === 0 && (
          <li className="flex flex-col items-center gap-2 px-6 py-14 text-center text-sm text-muted">
            <Tray size={32} weight="thin" />
            {q ? `Nothing matches “${q}”.` : filter === 'archived' ? 'Nothing archived.' : 'All caught up.'}
          </li>
        )}
        {shown.map((m) => {
          const active = selectedId === m.id
          return (
            <li key={m.id} className="border-b border-line last:border-0">
              <Link href={`${base}/${m.id}${qs}`} {...prefetchOnHover} className={cn('relative flex gap-3 px-4 py-3.5 transition-colors', active ? 'bg-brand-soft' : 'hover:bg-surface-2')}>
                {active && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-brand" />}
                <Avatar name={m.name} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={cn('truncate text-sm', m.readAt ? 'text-ink-2' : 'font-semibold text-ink')}>{m.name}</span>
                    <span className="shrink-0 text-[11.5px] text-faint">{relativeTime(m.receivedAt)}</span>
                  </div>
                  {m.topic && <span className="text-[12px] text-muted">{m.topic}</span>}
                  <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-muted">{m.message}</p>
                </div>
                <LinkPending className="mt-1 text-muted" />
                {!m.readAt && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" />}
              </Link>
            </li>
          )
        })}
      </ul>
    </>
  )
}

export function MessageActions({
  workspace,
  id,
  email,
  name,
  archived,
  filterQs,
}: {
  workspace: string
  id: string
  email: string
  name: string
  archived: boolean
  filterQs: string
}) {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const act = async (patch: { read?: boolean; archived?: boolean }, message: string, leave?: boolean) => {
    const r = await setMessageState(workspace, id, patch)
    if (!r.ok) return toast.error(r.error)
    toast.success(message)
    /* The action already refreshed the page's data (revalidatePath); only leaving needs a navigation. */
    if (leave) router.push(`/${workspace}/inbox${filterQs}`)
  }
  return (
    <div className="flex items-center gap-1.5">
      <Button asChild variant="ink" size="sm">
        <a href={`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`Re: your message`)}`}>
          <ArrowUUpLeft weight="bold" /> Reply
        </a>
      </Button>
      <Tooltip label="Mark unread">
        <Button variant="outline" size="icon-sm" onClick={() => act({ read: false }, 'Marked unread', true)} aria-label="Mark unread">
          <EnvelopeSimple />
        </Button>
      </Tooltip>
      <Tooltip label={archived ? 'Move to inbox' : 'Archive'}>
        <Button variant="outline" size="icon-sm" onClick={() => act({ archived: !archived }, archived ? 'Moved to inbox' : 'Archived', true)} aria-label={archived ? 'Unarchive' : 'Archive'}>
          {archived ? <EnvelopeSimpleOpen /> : <Archive />}
        </Button>
      </Tooltip>
      <Tooltip label="Delete">
        <Button variant="outline" size="icon-sm" onClick={() => setConfirm(true)} aria-label="Delete" className="text-danger">
          <Trash />
        </Button>
      </Tooltip>
      <Confirm
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete this message?"
        description={`The message from ${name} will be gone for good. Archive it instead if you might need it.`}
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          const r = await removeMessage(workspace, id)
          if (!r.ok) return void toast.error(r.error)
          setConfirm(false)
          toast.success('Message deleted')
          router.push(`/${workspace}/inbox${filterQs}`)
        }}
      />
    </div>
  )
}
