import Link from 'next/link'
import { Container } from '@/theme/components/container'

export default function NotFound() {
  return (
    <Container className="flex min-h-[80vh] flex-col justify-center pt-32">
      <p className="text-[16px] font-semibold text-mute">404</p>
      <h1 className="mt-4 font-display text-[clamp(3.5rem,10vw,10rem)] font-extrabold leading-[0.85] tracking-[-0.06em]">Lost the plot.</h1>
      <p className="mt-6 max-w-md text-[19px] text-ink-2">That page is not here. It may have moved, or it was never published.</p>
      <Link href="/" className="mt-10 self-start rounded-full bg-ink px-7 py-3.5 text-[16px] font-semibold text-paper">
        Back to the start
      </Link>
    </Container>
  )
}
