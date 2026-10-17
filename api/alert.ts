/**
 * Receives an alert from the watch (location + optional audio).
 * Phase 1 stub: validates nothing and echoes back. Real flow (phase 7):
 * 1. Notify contacts with location immediately (Telegram).
 * 2. Transcribe + summarize audio with Groq, then send the summary as a follow-up.
 * AI failures must never block or delay step 1.
 */
export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null);
  return Response.json({ received: body !== null, stub: true }, { status: 202 });
}
