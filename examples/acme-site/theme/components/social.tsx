import { FacebookLogo, GithubLogo, InstagramLogo, LinkedinLogo, TiktokLogo, XLogo, YoutubeLogo } from '@phosphor-icons/react/dist/ssr'
import type { SocialPlatform } from '@cms/site-kit'

export function SocialIcon({ platform, size = 18 }: { platform: SocialPlatform; size?: number }) {
  const Icon = { linkedin: LinkedinLogo, x: XLogo, instagram: InstagramLogo, facebook: FacebookLogo, youtube: YoutubeLogo, github: GithubLogo, tiktok: TiktokLogo }[platform]
  return <Icon size={size} />
}
