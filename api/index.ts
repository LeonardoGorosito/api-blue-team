// api/index.ts
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

    // Vercel entra aquí con URLs como:
    //   /api
    //   /api/health
    //   /api/auth/login
    //
    // Tus rutas en Fastify están definidas SIN /api:
    //   /health
    //   /auth/login
    //   /orders/:id/receipt
    //
    // Por eso le sacamos el prefijo /api antes de reenviar:
    const originalUrl = req.url || '/'
    const newUrl = originalUrl.replace(/^\/api/, '') || '/'

    // log opcional para ver qué le llega realmente a Fastify:
    console.log('Adaptando URL:', { originalUrl, newUrl })

    req.url = newUrl

    // Reenviamos la request al servidor Fastify
    app.server.emit('request', req, res)
  } catch (err) {
    console.error(err)
    if (!res.headersSent) {
      res.statusCode = 500
      res.end('Internal Server Error')
    }
  }
}
