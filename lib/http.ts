import { timingSafeEqual } from "node:crypto";

/** Checks `Authorization: Bearer <ALERT_API_TOKEN>` in constant time. */
export function isAuthorized(request: Request): boolean {
  const expected = process.env.ALERT_API_TOKEN;
  if (!expected) return false;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  const given = Buffer.from(token);
  const wanted = Buffer.from(expected);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

export function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export function errorResponse(error: string, status: number): Response {
  return Response.json({ error }, { status });
}
