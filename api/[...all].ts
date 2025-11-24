// api/[...all].ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
// @ts-ignore - importamos la app Fastify compilada
import app from '../dist/server.js'

let isReady = false

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!isReady) {
      await app.ready()
      isReady = true
    }

    // Vercel entra con:
    //   /api
    //   /api/health
    //   /api/auth/login
    // Tus rutas Fastify son:
    //   /health
    //   /auth/login
    const originalUrl = req.url || '/'
    const newUrl = originalUrl.replace(/^\/api/, '') || '/'

    console.log('Adaptando URL:', { originalUrl, newUrl })

    req.url = newUrl

    app.server.emit('request', req, res)
  } catch (err) {
    console.error(err)
    if (!res.headersSent) {
      res.statusCode = 500
      res.end('Internal Server Error')
    }
  }
}
