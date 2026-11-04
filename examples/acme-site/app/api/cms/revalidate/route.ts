import { revalidateHandler } from '@cms/site-kit/next'

/** The CMS calls this the moment content changes, so the site refreshes in seconds. */
export const POST = revalidateHandler({ secret: process.env.CMS_WEBHOOK_SECRET })
