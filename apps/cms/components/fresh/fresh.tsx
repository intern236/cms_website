import 'server-only'
import { FreshClient, FreshRemountClient } from './fresh-client'

/** When this page was rendered on the server (a server component renders once per request). */
const renderedNow = () => Date.now()

/**
 * Put on a page: if the page is shown from the browser's store (a prefetch, or a
 * visit in the last 30 s) and is older than `maxAgeMs`, it refreshes itself in the
 * background. See fresh-client.tsx.
 */
export function Fresh({ maxAgeMs = 10_000 }: { maxAgeMs?: number }) {
  return <FreshClient renderedAt={renderedNow()} maxAgeMs={maxAgeMs} />
}

/** The editor's version: re-opens it with fresh data if the copy shown was old. */
export function FreshRemount({ maxAgeMs = 3_000, children }: { maxAgeMs?: number; children: React.ReactNode }) {
  return (
    <FreshRemountClient renderedAt={renderedNow()} maxAgeMs={maxAgeMs}>
      {children}
    </FreshRemountClient>
  )
}
