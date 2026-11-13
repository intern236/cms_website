import type { NextConfig } from 'next'

/**
 * The CMS is an admin app and an API. Nothing here is meant to be indexed,
 * framed or cached by a shared proxy. The per-request Content-Security-Policy
 * (with a script nonce) is set in proxy.ts.
 */
const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: { unoptimized: true },
  serverExternalPackages: ['mongodb', '@electric-sql/pglite', 'pg'],
  experimental: {
    /*
     * Keep a visited or prefetched page in the browser for 30 seconds, so clicking
     * it is instant. Anything you change (a save, a publish) still refreshes it at
     * once: every action calls revalidatePath, which clears this store. A page
     * shown from the store that is more than a few seconds old refreshes itself
     * in the background (components/fresh).
     */
    staleTimes: { dynamic: 30, static: 30 },
    /* Links marked unstable_dynamicOnHover fetch their whole page when the pointer
       reaches them (or a finger touches), so the click that follows is instant. */
    dynamicOnHover: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
    ]
  },
}

export default nextConfig
