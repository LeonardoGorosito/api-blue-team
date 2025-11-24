// api/index.ts
import type { VercelRequest, VercelResponse } from '@vercel/node'

// Ignoramos el error de tipos porque server.js es JS compilado
// @ts-ignore
import app from '../dist/server.js'

let isReady = false

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!isReady) {
      await app.ready()
      isReady = true
    }

    // 🔥 Ajuste importante:
    // Vercel llama a esta función para /api y /api/*
    // Tus rutas en Fastify NO tienen el prefijo /api,
    // así que se lo sacamos de req.url antes de reenviarla.
    const originalUrl = req.url || '/'
    req.url = originalUrl.replace(/^\/api/, '') || '/'

    // Reenviamos la request a Fastify
    app.server.emit('request', req, res)
  } catch (err) {
    console.error(err)
    if (!res.headersSent) {
      res.statusCode = 500
      res.end('Internal Server Error')
    }
  }
}
