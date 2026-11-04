// Starts the built CMS for the end-to-end tests: production mode, a fresh
// throwaway database, no SMTP (emails land in the outbox), fixed secrets.
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const dir = mkdtempSync(path.join(tmpdir(), 'cms-e2e-'))
const env = {
  ...process.env,
  NODE_ENV: 'production',
  PORT: '3300',
  PGLITE_DIR: path.join(dir, 'pglite'),
  CMS_URL: 'http://localhost:3300',
  CMS_SECRET: 'e2e-secret-e2e-secret-e2e-secret-e2e-secret',
  CMS_SETUP_TOKEN: 'e2e-setup-token',
  CMS_SHOW_OUTBOX: 'true',
  CMS_ALLOW_PRIVATE_WEBHOOKS: 'true',
  AGENCY_NAME: 'Test Agency',
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: '',
}
delete env.SMTP_HOST
delete env.DATABASE_URL
// E2E_DATABASE_URL=postgres://… runs against a real (empty) Postgres, migrated the way `npm start` does.
if (process.env.E2E_DATABASE_URL) env.DATABASE_URL = process.env.E2E_DATABASE_URL
const command = env.DATABASE_URL ? 'node scripts/migrate.mjs && npx next start --port 3300' : 'npx next start --port 3300'
const child = spawn(command, { env, stdio: 'inherit', shell: true })
// Playwright stops this whole process group when the run ends.
const stop = () => child.kill('SIGTERM')
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
child.on('exit', (code) => process.exit(code ?? 0))
