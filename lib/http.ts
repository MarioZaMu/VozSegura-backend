// Shared HTTP helpers for the Web-standard handlers in api/.

// The frontend runs on another origin (its own Vercel project), so every response
// carries CORS headers. ALLOWED_ORIGIN narrows it in production.
const allowedOrigin = process.env.ALLOWED_ORIGIN ?? '*'

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
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
