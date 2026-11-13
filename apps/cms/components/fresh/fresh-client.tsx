'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

/*
 * STALE-WHILE-REVALIDATE FOR PAGES.
 *
 * Sidebar pages are fetched ahead of the click (prefetch) and visited pages are
 * kept for 30 seconds, so a click shows a page at once. A page shown from that
 * store may be some seconds old; these components notice and quietly ask the
 * server for a fresh copy, which swaps in without losing what is on screen.
 *
 * Age is measured against the server clock: the first page loaded tells us how
 * far the browser's clock is from the server's.
 */

let offset: number | null = null

function ageOf(renderedAt: number): number {
  const now = Date.now()
  if (offset === null) {
    offset = now - renderedAt // the first page seen is fresh by definition
    return 0
  }
  return now - offset - renderedAt
}

/** Lists and dashboards: refresh in the background when what is shown is older than `maxAgeMs`. */
export function FreshClient({ renderedAt, maxAgeMs }: { renderedAt: number; maxAgeMs: number }) {
  const router = useRouter()
  useEffect(() => {
    if (ageOf(renderedAt) > maxAgeMs) router.refresh()
  }, [renderedAt, maxAgeMs, router])
  return null
}

/**
 * For the editor, whose fields are set once from the page: if the copy it opened
 * with was old, fetch a fresh one and re-open the editor with it, once, right
 * after opening (before anyone has had time to type).
 */
export function FreshRemountClient({ renderedAt, maxAgeMs, children }: { renderedAt: number; maxAgeMs: number; children: React.ReactNode }) {
  const router = useRouter()
  const [generation, setGeneration] = useState(0)
  const waitingSince = useRef<number | null>(null)
  useEffect(() => {
    if (ageOf(renderedAt) > maxAgeMs) {
      waitingSince.current = renderedAt
      router.refresh()
    }
    // Only when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (waitingSince.current !== null && renderedAt !== waitingSince.current) {
      waitingSince.current = null
      setGeneration((g) => g + 1)
    }
  }, [renderedAt])
  return <Fragment key={generation}>{children}</Fragment>
}
