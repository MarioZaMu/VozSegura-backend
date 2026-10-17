import { isDemoMode } from "../lib/config.js";
import { errorResponse, isAuthorized, jsonResponse } from "../lib/http.js";
import { alertText } from "../lib/messages.js";
import { parseAlertPayload } from "../lib/payload.js";
import { resolveChatIds } from "../lib/recipients.js";
import { sendLocation, sendMessage } from "../lib/telegram.js";

/**
 * Step 1 of an alert: notify every trusted contact right away with the message, time and
 * location. No AI here on purpose, so nothing can slow this down; the audio summary arrives
 * later through /api/audio.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isAuthorized(request)) return errorResponse("unauthorized", 401);

  const payload = parseAlertPayload(await request.json().catch(() => null));
  if (!payload) return errorResponse("invalid_payload", 400);

  const chatIds = resolveChatIds(payload.contactChatIds);
  if (chatIds.length === 0) return errorResponse("no_contacts", 422);

  if (isDemoMode(request)) {
    return jsonResponse({ alertId: payload.alertId, delivered: chatIds.length, demo: true });
  }

  const results = await Promise.allSettled(
    chatIds.map(async (chatId) => {
      await sendMessage(chatId, alertText(payload));
      const location = payload.location;
      if (location) {
        await sendLocation(chatId, location.latitude, location.longitude, location.accuracyMeters);
      }
    }),
  );
  const delivered = results.filter((result) => result.status === "fulfilled").length;
  results
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .forEach((result) => console.error("alert delivery failed:", String(result.reason)));

  // The watch retries on failure, so only report success if at least one contact was reached.
  if (delivered === 0) return errorResponse("delivery_failed", 502);
  return jsonResponse({ alertId: payload.alertId, delivered, failed: chatIds.length - delivered });
}
