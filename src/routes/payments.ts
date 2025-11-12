import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

export default async function payments(app: FastifyInstance) {
  // Mercado Pago (stub inicial; luego llamás al SDK y devolvés init_point)
  app.post('/payments/mp/preference', async (req, reply) => {
    const body = z.object({ orderId: z.string() }).parse(req.body)
    // TODO: crear preferencia real con SDK de MP
    return { init_point: `https://www.mercadopago.com/checkout/v2/fake?order=${body.orderId}` }
  })

  // Transferencia (stub: recibo por multipart)
  app.register(import('@fastify/multipart').then(m => m.default))
  app.post('/payments/transfer', async (req, reply) => {
    // TODO: guardar archivo en storage y crear Payment con status PENDING_REVIEW
    return { ok: true }
  })
}
