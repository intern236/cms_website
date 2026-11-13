import type { Metadata } from 'next'
import { BrandingForm } from '@/components/settings/branding-form'
import { GeneralForm } from '@/components/settings/general-form'
import { PeoplePanel } from '@/components/settings/people-panel'
import { SettingsTabs } from '@/components/settings/settings-tabs'
import { WebsitePanel } from '@/components/settings/website-panel'
import { PageHeader } from '@/components/ui/page-header'
import { requireWorkspace } from '@/lib/auth/access'
import { cmsUrl } from '@/lib/env'
import { listSiteKeys } from '@/lib/integrations/site-keys'
import { recentDeliveries } from '@/lib/integrations/webhooks'
import { listMembers, pendingInvites } from '@/lib/workspaces/members'
import { Fresh } from '@/components/fresh/fresh'

export const metadata: Metadata = { title: 'Settings' }

const TABS = [
  { key: 'general', label: 'Site' },
  { key: 'branding', label: 'Branding' },
  { key: 'people', label: 'People' },
  { key: 'website', label: 'Website & keys' },
] as const

type Tab = (typeof TABS)[number]['key']

export default async function SettingsPage({ params, searchParams }: { params: Promise<{ workspace: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { workspace } = await params
  const { tab: raw } = await searchParams
  const access = await requireWorkspace(workspace, 'settings.edit')
  const tab: Tab = TABS.some((t) => t.key === raw) ? (raw as Tab) : 'general'
  const ws = access.workspace

  /* Every panel's data at once, so the tabs switch in the browser. */
  const [members, invites, keys, deliveries] = await Promise.all([listMembers(ws.id), pendingInvites(ws.id), listSiteKeys(ws.id), recentDeliveries(ws.id)])

  return (
    <>
      <Fresh />
      <PageHeader title="Settings" description={`How ${ws.name} looks, who can sign in, and how the website connects.`} />
      <SettingsTabs
        tabs={TABS}
        initial={tab}
        panels={{
          general: <GeneralForm workspace={workspace} initial={ws.settings} />,
          branding: <BrandingForm workspace={workspace} initial={{ name: ws.name, accent: ws.accent, hasLogo: ws.hasLogo, version: ws.updatedAt.getTime() }} />,
          people: (
            <PeoplePanel
              workspace={workspace}
              workspaceName={ws.name}
              me={access.user.id}
              myRole={access.role}
              members={members.map((m) => ({ ...m, lastLoginAt: m.lastLoginAt?.toISOString() ?? null }))}
              invites={invites.map((i) => ({ id: i.id, email: i.email, role: i.role, expiresAt: i.expiresAt.toISOString() }))}
            />
          ),
          website: (
            <WebsitePanel
              workspace={workspace}
              isAgency={access.isAgency}
              cmsUrl={cmsUrl()}
              siteUrl={ws.siteUrl}
              webhookUrl={ws.webhookUrl}
              keys={keys.map((k) => ({
                id: k.id,
                label: k.label,
                prefix: k.prefix,
                createdAt: k.createdAt.toISOString(),
                lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
                revokedAt: k.revokedAt?.toISOString() ?? null,
              }))}
              deliveries={deliveries.map((d) => ({ id: d.id, event: d.event, ok: d.ok, status: d.status, error: d.error, at: d.at.toISOString(), durationMs: d.durationMs }))}
            />
          ),
        }}
      />
    </>
  )
}
