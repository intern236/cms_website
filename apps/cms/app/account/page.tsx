import type { Metadata } from 'next'
import { AccountForms } from '@/components/account/account-forms'
import { AppShell } from '@/components/shell/app-shell'
import { PageHeader } from '@/components/ui/page-header'
import { getAccess, requireUser } from '@/lib/auth/access'
import { listSessions } from '@/lib/auth/session'
import { brandStyle } from '@/lib/brand-style'
import { mailConfigured } from '@/lib/env'
import { shellProps } from '@/lib/shell'
import { Fresh } from '@/components/fresh/fresh'

export const metadata: Metadata = { title: 'Your account' }

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams
  /* The sign-in check and the workspace look-up together, then the sidebar and the device list together. */
  const [user, access] = await Promise.all([requireUser('/account'), typeof from === 'string' ? getAccess(from) : null])
  const [props, sessions] = await Promise.all([shellProps(user, access), listSessions(user.id)])
  return (
    <div style={access ? brandStyle(access.workspace.accent) : undefined}>
      <AppShell {...props}>
        <Fresh />
        <PageHeader title="Your account" description="Your name, password, sign-in codes and devices. These apply in every workspace you belong to." />
        <AccountForms
          name={user.name}
          email={user.email}
          twoFactor={user.twoFactor}
          mailReady={mailConfigured()}
          currentSession={user.sessionId}
          sessions={sessions.reverse().map((s) => ({ id: s.id, userAgent: s.userAgent, lastSeenAt: s.lastSeenAt.toISOString(), createdAt: s.createdAt.toISOString() }))}
        />
      </AppShell>
    </div>
  )
}
