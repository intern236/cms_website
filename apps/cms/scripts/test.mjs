// `npm test` runs the unit suite on MongoDB; `npm run test:postgres` on PGlite
// (an in-process Postgres). Pass extra vitest arguments after `--`.
// For a real Postgres server: TEST_DB=postgres TEST_POSTGRES_URL=postgres://… npx vitest run
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'

const [db = 'mongo', ...rest] = process.argv.slice(2)
const pkg = createRequire(import.meta.url).resolve('vitest/package.json')
const vitest = path.join(path.dirname(pkg), 'vitest.mjs')
const child = spawn(process.execPath, [vitest, 'run', ...rest], { stdio: 'inherit', env: { ...process.env, TEST_DB: db } })
child.on('exit', (code) => process.exit(code ?? 1))
