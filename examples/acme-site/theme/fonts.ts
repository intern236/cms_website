import localFont from 'next/font/local'
import { Newsreader } from 'next/font/google'

/** Cabinet Grotesk (Indian Type Foundry, via Fontshare — free for commercial use), self-hosted. */
export const cabinet = localFont({
  src: [
    { path: '../app/fonts/CabinetGrotesk-400.woff2', weight: '400' },
    { path: '../app/fonts/CabinetGrotesk-500.woff2', weight: '500' },
    { path: '../app/fonts/CabinetGrotesk-700.woff2', weight: '700' },
    { path: '../app/fonts/CabinetGrotesk-800.woff2', weight: '800' },
  ],
  variable: '--font-cabinet',
  display: 'swap',
})

export const newsreader = Newsreader({ subsets: ['latin'], variable: '--font-newsreader', display: 'swap', style: ['normal', 'italic'] })
