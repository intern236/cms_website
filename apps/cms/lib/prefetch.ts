/**
 * Spread on a <Link>: fetch the whole page, data included, the moment the
 * pointer reaches the link (or a finger touches it), so the click that follows
 * is instant. Needs `experimental.dynamicOnHover` (next.config.ts).
 *
 * (Next's App Router supports this prop; its public Link type does not list it yet.)
 */
export const prefetchOnHover = { unstable_dynamicOnHover: true } as object
