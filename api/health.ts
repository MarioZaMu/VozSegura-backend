import { json, preflight } from '../lib/http.js'

export function GET(): Response {
  return json({ status: 'ok', service: 'voz-segura-backend', time: new Date().toISOString() })
}

export function OPTIONS(): Response {
  return preflight()
}
