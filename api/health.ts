import { json, preflight, withCors } from '../lib/http.js'

function handleGET(): Response {
  return json({ status: 'ok', service: 'voz-segura-backend', time: new Date().toISOString() })
}

export const GET = withCors(handleGET)
export const OPTIONS = withCors(preflight)
