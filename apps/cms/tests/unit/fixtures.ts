import bcrypt from 'bcryptjs'
import { newId, sys } from '@/lib/db'
import { users, type Role } from '@/lib/db/schema'
import { createSession, SESSION_COOKIE } from '@/lib/auth/session'
import { createWorkspace } from '@/lib/workspaces'
import { addMember } from '@/lib/workspaces/members'
import { createSiteKey } from '@/lib/integrations/site-keys'
import { jar, requestHeaders, resetRequest } from './next-mocks'

export const PASSWORD = 'correct-horse-battery-staple'
const HASH = bcrypt.hashSync(PASSWORD, 4)

let counter = 0

export async function makeUser(opts: { email?: string; name?: string; isAgency?: boolean; twoFactor?: boolean } = {}) {
  const db = await sys()
  const id = newId()
  counter++
  const email = opts.email ?? `user${counter}-${id.slice(0, 6)}@example.com`
  await db.insert(users).values({
    id,
    email,
    name: opts.name ?? `User ${counter}`,
    passwordHash: HASH,
    isAgency: opts.isAgency ?? false,
    twoFactor: opts.twoFactor ?? false,
  })
  return { id, email, name: opts.name ?? `User ${counter}` }
}

export async function makeWorkspace(slug: string, settings: Record<string, unknown> = {}) {
  const r = await createWorkspace({ name: slug.toUpperCase(), slug, siteUrl: `https://${slug}.example`, accent: '#123456', settings })
  if (!r.ok) throw new Error(JSON.stringify(r.errors))
  return r.workspace
}

export async function member(workspaceId: string, role: Role) {
  const u = await makeUser()
  await addMember(workspaceId, u.id, role)
  return u
}

/** Make the next calls run as this user (fresh request, their session cookie). */
export async function signInAs(user: { id: string }, ip = '203.0.113.10') {
  resetRequest()
  requestHeaders.set('x-forwarded-for', ip)
  requestHeaders.set('user-agent', 'vitest')
  await createSession(user.id)
  const token = jar.get(SESSION_COOKIE)!
  resetRequest()
  requestHeaders.set('x-forwarded-for', ip)
  jar.set(SESSION_COOKIE, token)
  return token
}

export function signOut(ip = '203.0.113.10') {
  resetRequest()
  requestHeaders.set('x-forwarded-for', ip)
}

export async function siteKeyFor(workspaceId: string) {
  const u = await makeUser()
  return (await createSiteKey(workspaceId, 'test', u.id)).key
}

export function post(over: Record<string, unknown> = {}) {
  return {
    title: 'A post',
    slug: '',
    description: 'A description long enough to be useful in a search result snippet.',
    excerpt: '',
    tags: ['News'],
    faqs: [],
    category: '',
    format: 'editor',
    contentHtml: '<p>Hello world</p>',
    authorId: '',
    coverImage: null,
    coverAlt: '',
    coverCaption: '',
    seoTitle: '',
    focusKeyword: '',
    intent: 'save' as const,
    ...over,
  }
}
