// Telegram bot notifications to the trusted contacts.
import type { LocationFix } from './alertModel.js'
import { contactChatIds, requireEnv } from './env.js'

async function callTelegram(method: string, body: Record<string, unknown>): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${requireEnv('TELEGRAM_BOT_TOKEN')}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  })
  const data = (await response.json()) as { ok: boolean; description?: string }
  if (!data.ok) throw new Error(`Telegram ${method} failed: ${data.description ?? response.status}`)
}

/** Sends to every contact; one failing chat never blocks the others. Returns how many got it. */
async function toAllContacts(send: (chatId: string) => Promise<void>): Promise<number> {
  const results = await Promise.allSettled(contactChatIds().map(send))
  results.forEach((result) => result.status === 'rejected' && console.error(result.reason))
  return results.filter((result) => result.status === 'fulfilled').length
}

export function sendMessageToContacts(html: string): Promise<number> {
  return toAllContacts((chatId) =>
    callTelegram('sendMessage', { chat_id: chatId, text: html, parse_mode: 'HTML', link_preview_options: { is_disabled: true } }),
  )
}

/** A native map pin: contacts can open it in their maps app with one tap. */
export function sendLocationToContacts(fix: LocationFix): Promise<number> {
  return toAllContacts((chatId) =>
    callTelegram('sendLocation', {
      chat_id: chatId,
      latitude: fix.latitude,
      longitude: fix.longitude,
      horizontal_accuracy: Math.min(Math.round(fix.accuracy), 1500),
    }),
  )
}
