// Shared HTTP helpers for the Web-standard handlers in api/.
import { timingSafeEqual } from 'node:crypto'

// The frontend runs on another origin (its own Vercel project), so every response
// carries CORS headers. ALLOWED_ORIGIN (comma separated) narrows it in production; the
// Android app's WebView origin is always allowed because its Settings view calls the API.
const CAPACITOR_ORIGIN = 'https://localhost'
const allowedOrigins = (process.env.ALLOWED_ORIGIN ?? '*').split(',').map((origin) => origin.trim())

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': allowedOrigins[0],
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
}

/** The origin to echo back: the caller's when it is allowed, else the first configured one. */
export function corsOrigin(requestOrigin: string | null): string {
  if (allowedOrigins.includes('*')) return '*'
  if (requestOrigin && (allowedOrigins.includes(requestOrigin) || requestOrigin === CAPACITOR_ORIGIN)) return requestOrigin
  return allowedOrigins[0]
}

type Handler = (request: Request) => Response | Promise<Response>

/** Wraps an endpoint so its response allows the calling origin (see corsOrigin). */
export function withCors(handler: Handler): Handler {
  return async (request) => {
    const response = await handler(request)
    response.headers.set('Access-Control-Allow-Origin', corsOrigin(request.headers.get('origin')))
    return response
  }
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
