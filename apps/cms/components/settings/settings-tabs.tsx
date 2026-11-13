'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type SettingsTab = 'general' | 'branding' | 'people' | 'website'

/**
 * The settings sections. Every panel arrives with the page, so switching is a
 * browser-only change: no server trip. The address keeps the tab (?tab=) so a
 * reload or a shared link opens the same one.
 */
export function SettingsTabs({ tabs, initial, panels }: { tabs: readonly { key: SettingsTab; label: string }[]; initial: SettingsTab; panels: Record<SettingsTab, ReactNode> }) {
  const [tab, setTab] = useState<SettingsTab>(initial)
  const select = (key: SettingsTab) => {
    setTab(key)
    const url = new URL(window.location.href)
    if (key === 'general') url.searchParams.delete('tab')
    else url.searchParams.set('tab', key)
    window.history.replaceState(window.history.state, '', url)
  }
  return (
    <>
      <nav className="-mx-1 mb-8 flex gap-1 overflow-x-auto border-b border-line px-1 scrollbar-none" aria-label="Settings sections">
        {tabs.map((t) => (
          <a
            key={t.key}
            href={`?${t.key === 'general' ? '' : `tab=${t.key}`}`}
            aria-current={tab === t.key ? 'page' : undefined}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
              e.preventDefault()
              select(t.key)
            }}
            className={cn(
              'relative -mb-px whitespace-nowrap border-b-2 px-3 pb-3 text-sm font-medium transition-colors',
              tab === t.key ? 'border-brand text-ink' : 'border-transparent text-muted hover:text-ink',
            )}
          >
            {t.label}
          </a>
        ))}
      </nav>
      <div key={tab}>{panels[tab]}</div>
    </>
  )
}
