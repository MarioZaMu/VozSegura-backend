// Telegram bot notifications to the trusted contacts.
import type { LocationFix } from './alertModel.js'
import { requireEnv } from './env.js'

async function callTelegram(method: string, body: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(`https://api.telegram.org/bot${requireEnv('TELEGRAM_BOT_TOKEN')}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  })
  const data = (await response.json()) as { ok: boolean; description?: string; result?: unknown }
  if (!data.ok) throw new Error(`Telegram ${method} failed: ${data.description ?? response.status}`)
  return data.result
}

let botUsername: string | null = null

/** The bot's @username (for invite links), read once from Telegram. */
export async function getBotUsername(): Promise<string> {
  botUsername ??= ((await callTelegram('getMe', {})) as { username: string }).username
  return botUsername
}

export async function sendMessage(chatId: string, html: string): Promise<void> {
  await callTelegram('sendMessage', { chat_id: chatId, text: html, parse_mode: 'HTML', link_preview_options: { is_disabled: true } })
}

/** Sends to every chat; one failing chat never blocks the others. Returns how many got it. */
async function toAll(chatIds: string[], send: (chatId: string) => Promise<unknown>): Promise<number> {
  const results = await Promise.allSettled(chatIds.map(send))
  results.forEach((result) => result.status === 'rejected' && console.error(result.reason))
  return results.filter((result) => result.status === 'fulfilled').length
}

export function sendMessageToAll(chatIds: string[], html: string): Promise<number> {
  return toAll(chatIds, (chatId) => sendMessage(chatId, html))
}

/** A native map pin: contacts can open it in their maps app with one tap. */
export function sendLocationToAll(chatIds: string[], fix: LocationFix): Promise<number> {
  return toAll(chatIds, (chatId) =>
    callTelegram('sendLocation', {
      chat_id: chatId,
      latitude: fix.latitude,
      longitude: fix.longitude,
      horizontal_accuracy: Math.min(Math.round(fix.accuracy), 1500),
    }),
  )
}
