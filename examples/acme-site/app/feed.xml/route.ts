import { feedHandler } from '@cms/site-kit/next'
import { cms } from '@/cms'

export const revalidate = 60
export const GET = feedHandler(cms)
