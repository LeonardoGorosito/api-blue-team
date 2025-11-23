// api/index.ts
import type { VercelRequest, VercelResponse } from '@vercel/node'

// 👇 Esta línea es la que rompe el build
//    Le agregamos un ts-ignore para que no moleste.
 // @ts-ignore - app es el Fastify compilado desde dist/server.js
import app from '../dist/server.js'

let isReady = false

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!isReady) {
      await app.ready()
      isReady = true
    }

    // Reenviamos la request al server de Fastify
    app.server.emit('request', req, res)
  } catch (err) {
    console.error(err)
    if (!res.headersSent) {
      res.statusCode = 500
      res.end('Internal Server Error')
    }
  }
}
