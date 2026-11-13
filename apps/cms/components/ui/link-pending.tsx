'use client'

import { useLinkStatus } from 'next/link'
import { cn } from '@/lib/utils'

/**
 * Put inside a <Link>: a small spinner that appears while that link's page is on
 * its way, so a click always answers at once. Fast pages arrive before it shows
 * (it fades in after 120 ms), so it never flickers.
 */
export function LinkPending({ className }: { className?: string }) {
  const { pending } = useLinkStatus()
  return (
    <span
      aria-hidden
      data-pending={pending || undefined}
      className={cn(
        'pointer-events-none size-3.5 shrink-0 rounded-full border-2 border-current border-r-transparent opacity-0 transition-opacity',
        pending && 'animate-spin opacity-60 delay-[120ms]',
        className
      )}
    />
  )
}
