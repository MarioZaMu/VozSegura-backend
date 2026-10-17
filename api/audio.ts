import { isDemoMode } from "../lib/config.js";
import { summarize, transcribe } from "../lib/groq.js";
import { errorResponse, isAuthorized, jsonResponse } from "../lib/http.js";
import { AUDIO_CAPTION, SUMMARY_UNAVAILABLE_TEXT, summaryText } from "../lib/messages.js";
import { resolveChatIds } from "../lib/recipients.js";
import { sendAudio, sendMessage } from "../lib/telegram.js";

/** Vercel caps request bodies at 4.5 MB; a 30 s clip is ~120 KB. */
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

export const DEMO_SUMMARY =
  "Se escuchan voces alteradas y una persona pide que la dejen en paz. Posible situación de riesgo.";

/**
 * Step 2 of an alert: the audio clip. Body is the raw clip (audio/mp4); alert id and contacts
 * travel in the query string: `/api/audio?alertId=...&chatIds=1,2`.
 *
 * The AI only adds context. If transcription or summary fails, contacts still get the audio,
 * and the alert itself already went out through /api/alert before this was called.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isAuthorized(request)) return errorResponse("unauthorized", 401);

  const url = new URL(request.url);
  const alertId = url.searchParams.get("alertId") ?? "";
  if (alertId.length === 0 || alertId.length > 64) return errorResponse("invalid_alert_id", 400);

  const requested = (url.searchParams.get("chatIds") ?? "").split(",").filter(Boolean);
  const chatIds = resolveChatIds(requested);
  if (chatIds.length === 0) return errorResponse("no_contacts", 422);

  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0) return errorResponse("empty_audio", 400);
  if (bytes.byteLength > MAX_AUDIO_BYTES) return errorResponse("audio_too_large", 413);

  if (isDemoMode(request)) {
    return jsonResponse({ alertId, summary: DEMO_SUMMARY, summaryStatus: "ok", demo: true });
  }

  const audio = new Blob([bytes], { type: request.headers.get("content-type") ?? "audio/mp4" });
  const filename = `alerta-${alertId}.m4a`;

  let summary: string | null = null;
  try {
    summary = await summarize(await transcribe(audio, filename));
  } catch (error) {
    console.error("AI summary failed, sending audio without it:", String(error));
  }

  const results = await Promise.allSettled(
    chatIds.map(async (chatId) => {
      await sendMessage(chatId, summary ? summaryText(summary) : SUMMARY_UNAVAILABLE_TEXT);
      await sendAudio(chatId, audio, filename, AUDIO_CAPTION);
    }),
  );
  const delivered = results.filter((result) => result.status === "fulfilled").length;
  if (delivered === 0) return errorResponse("delivery_failed", 502);

  return jsonResponse({ alertId, summary, summaryStatus: summary ? "ok" : "failed", delivered });
}
