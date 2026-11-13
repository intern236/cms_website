import type { Metadata } from 'next'
import { InboxView } from '@/components/inbox/inbox-view'
import { requireWorkspace } from '@/lib/auth/access'
import { inboxData } from '@/lib/inbox-data'
import { openMessage } from './message'
import { Fresh } from '@/components/fresh/fresh'

export const metadata: Metadata = { title: 'Message' }

export default async function MessagePage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string; id: string }>
  searchParams: Promise<{ filter?: string; q?: string }>
}) {
  const { workspace, id } = await params
  const access = await requireWorkspace(workspace, 'inbox.read')
  const data = await inboxData(access, await searchParams, () => openMessage(workspace, id))
  return (
    <>
      <Fresh />
      <InboxView workspace={workspace} {...data} />
    </>
  )
}
