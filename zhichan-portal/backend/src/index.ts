import { createServer } from 'node:http'
import { createApp } from './app'
import { env } from './config/env'
import { prisma } from './lib/prisma'
import { setupSocket } from './sockets'

const app = createApp()
const server = createServer(app)

setupSocket(server)

async function main() {
  await prisma.$connect()
  console.log('[prisma] database connected')

  server.listen(env.port, () => {
    console.log(`[server] listening on http://localhost:${env.port}`)
  })
}

main().catch(async (err) => {
  console.error('[fatal]', err)
  await prisma.$disconnect()
  process.exit(1)
})
