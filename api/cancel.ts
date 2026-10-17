import { isDemoMode } from "../lib/config.js";
import { errorResponse, isAuthorized, jsonResponse } from "../lib/http.js";
import { CANCELLATION_TEXT } from "../lib/messages.js";
import { parseCancelPayload } from "../lib/payload.js";
import { resolveChatIds } from "../lib/recipients.js";
import { sendMessage } from "../lib/telegram.js";

/** Tells contacts the alert is over ("estoy bien"). Only called after an alert may have gone out. */
export async function POST(request: Request): Promise<Response> {
  if (!isAuthorized(request)) return errorResponse("unauthorized", 401);

  const payload = parseCancelPayload(await request.json().catch(() => null));
  if (!payload) return errorResponse("invalid_payload", 400);

  const chatIds = resolveChatIds(payload.contactChatIds);
  if (chatIds.length === 0) return errorResponse("no_contacts", 422);

  if (isDemoMode(request)) return jsonResponse({ alertId: payload.alertId, delivered: chatIds.length, demo: true });

  const results = await Promise.allSettled(chatIds.map((chatId) => sendMessage(chatId, CANCELLATION_TEXT)));
  const delivered = results.filter((result) => result.status === "fulfilled").length;
  if (delivered === 0) return errorResponse("delivery_failed", 502);
  return jsonResponse({ alertId: payload.alertId, delivered });
}
