// src/dev-server.ts
import app from './server.js'
import { ENV } from './env.js'

const start = async () => {
  try {
    const port = Number(ENV.PORT) || 3000
    await app.listen({ port, host: '0.0.0.0' })
    app.log.info(`Servidor HTTP corriendo en http://localhost:${port}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
