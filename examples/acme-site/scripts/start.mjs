// `npm start`, on any OS: serves the built site on $PORT, or 3100 (next to the CMS on 3000).
import { spawn } from 'node:child_process'

const port = process.env.PORT || '3100'
const child = spawn('npx', ['next', 'start', '--port', port], { stdio: 'inherit', shell: process.platform === 'win32' })
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
child.on('exit', (code) => process.exit(code ?? 0))
