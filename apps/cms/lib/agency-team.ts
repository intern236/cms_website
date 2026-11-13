import 'server-only'
import { sys } from '@/lib/db'

export async function agencyTeam() {
  const db = await sys()
  const [people, invites] = await Promise.all([db.users.agency(), db.invites.pending(null, new Date())])
  const members = people.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    lastLoginAt: u.lastLoginAt,
    twoFactor: u.twoFactor,
    disabledAt: u.disabledAt,
  }))
  const pending = invites.map((i) => ({ id: i.id, email: i.email, expiresAt: i.expiresAt }))
  return { members, pending }
}
