import dotenv from 'dotenv'
dotenv.config()

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }
  return value
}

export const ENV = {
  PORT: Number(process.env.PORT || 3000),
  FRONTEND_URL: required('FRONTEND_URL'),
  JWT_SECRET: required('JWT_SECRET'),
}
