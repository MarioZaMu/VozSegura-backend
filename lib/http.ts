// Shared HTTP helpers for the Web-standard handlers in api/.
import { timingSafeEqual } from 'node:crypto'

// The frontend runs on another origin (its own Vercel project), so every response
// carries CORS headers. ALLOWED_ORIGIN narrows it in production.
const allowedOrigin = process.env.ALLOWED_ORIGIN ?? '*'

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: corsHeaders })
}

export function errorResponse(message: string, status: number): Response {
  return json({ error: message }, status)
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: corsHeaders })
}

/**
 * Write endpoints require `Authorization: Bearer <ALERT_API_TOKEN>`. The token ships inside
 * the app, so it only keeps out casual abuse; per-device keys come with phase 7.
 */
export function isAuthorized(request: Request): boolean {
  const expected = process.env.ALERT_API_TOKEN
  const header = request.headers.get('authorization') ?? ''
  if (!expected || !header.startsWith('Bearer ')) return false
  const given = Buffer.from(header.slice('Bearer '.length))
  const wanted = Buffer.from(expected)
  return given.length === wanted.length && timingSafeEqual(given, wanted)
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json()
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : null
  } catch {
    return null
  }
}
