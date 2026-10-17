import { timingSafeEqual } from "node:crypto";
import { startReplyText } from "../lib/messages.js";
import { sendMessage } from "../lib/telegram.js";

interface TelegramUpdate {
  message?: { chat?: { id?: number }; text?: string };
}

function hasValidSecret(request: Request): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return false;
  const given = Buffer.from(request.headers.get("x-telegram-bot-api-secret-token") ?? "");
  const wanted = Buffer.from(expected);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

/**
 * Telegram webhook. When a future trusted contact sends /start to the bot, it answers with
 * their chat id, which the user then types into the phone app. This is how contacts opt in:
 * a bot can only message people who started it first.
 */
export async function POST(request: Request): Promise<Response> {
  if (!hasValidSecret(request)) return new Response("forbidden", { status: 403 });

  const update = (await request.json().catch(() => ({}))) as TelegramUpdate;
  const chatId = update.message?.chat?.id;
  const text = update.message?.text ?? "";
  if (chatId !== undefined && text.startsWith("/start")) {
    try {
      await sendMessage(String(chatId), startReplyText(String(chatId)));
    } catch (error) {
      console.error("start reply failed:", String(error));
    }
  }
  // Always 200: otherwise Telegram keeps re-sending the same update.
  return new Response("ok");
}
