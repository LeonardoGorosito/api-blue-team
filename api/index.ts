// api/index.ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
// @ts-ignore
import app from '../dist/server.js'

let isReady = false

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!isReady) {
      await app.ready()
      isReady = true
    }

    // 🔥 Fix crítico: Fastify no usa el prefijo /api.
    // Si llega /api/health → lo convertimos a /health
    const originalUrl = req.url || '/'
    req.url = originalUrl.replace(/^\/api/, '') || '/'

    app.server.emit('request', req, res)
  } catch (err) {
    console.error(err)
    if (!res.headersSent) {
      res.statusCode = 500
      res.end('Internal Server Error')
    }
  }
}
