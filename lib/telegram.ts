import { requireEnv } from "./config.js";

const TELEGRAM_API = "https://api.telegram.org";
const TIMEOUT_MS = 10_000;

async function callTelegram(method: string, body: Record<string, unknown> | FormData): Promise<void> {
  const url = `${TELEGRAM_API}/bot${requireEnv("TELEGRAM_BOT_TOKEN")}/${method}`;
  const isForm = body instanceof FormData;
  const response = await fetch(url, {
    method: "POST",
    headers: isForm ? undefined : { "content-type": "application/json" },
    body: isForm ? body : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    // Never log the URL: it contains the bot token.
    throw new Error(`Telegram ${method} failed with HTTP ${response.status}`);
  }
}

export function sendMessage(chatId: string, html: string): Promise<void> {
  return callTelegram("sendMessage", {
    chat_id: chatId,
    text: html,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
}

export function sendLocation(
  chatId: string,
  latitude: number,
  longitude: number,
  accuracyMeters?: number | null,
): Promise<void> {
  return callTelegram("sendLocation", {
    chat_id: chatId,
    latitude,
    longitude,
    // Telegram accepts 0..1500 m.
    ...(accuracyMeters ? { horizontal_accuracy: Math.min(Math.max(accuracyMeters, 0), 1500) } : {}),
  });
}

export function sendAudio(chatId: string, audio: Blob, filename: string, captionHtml: string): Promise<void> {
  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("caption", captionHtml);
  form.append("parse_mode", "HTML");
  form.append("audio", audio, filename);
  return callTelegram("sendAudio", form);
}
