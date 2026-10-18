// POST /api/telegram — Telegram bot webhook (registered with scripts/set-webhook.ts).
// "/start <code>" links the chat to the invite's contact, "/stop" unsubscribes it.
// Telegram proves it is the caller with the secret token header set at registration.
import { timingSafeEqual } from 'node:crypto'
import { HELLO_MESSAGE, INVALID_INVITE_MESSAGE, parseBotCommand, stoppedMessage, welcomeMessage } from '../lib/contactModel.js'
import { acceptInvite, leaveAll } from '../lib/contactStore.js'
import { sendMessage } from '../lib/telegram.js'

type TelegramUpdate = {
  message?: { text?: string; chat?: { id?: number; type?: string }; from?: { first_name?: string } }
}

function isFromTelegram(request: Request): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET ?? ''
  const given = request.headers.get('x-telegram-bot-api-secret-token') ?? ''
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return expected !== '' && a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: Request): Promise<Response> {
  if (!isFromTelegram(request)) return new Response('Forbidden', { status: 403 })

  const update = (await request.json().catch(() => ({}))) as TelegramUpdate
  const message = update.message
  const chatId = message?.chat?.id
  // Only private chats can be contacts; groups and other updates are ignored.
  if (!message || chatId === undefined || message.chat?.type !== 'private') return new Response('ok')

  const firstName = message.from?.first_name ?? ''
  const command = parseBotCommand(message.text)
  try {
    if (command.command === 'start' && command.code) {
      const device = await acceptInvite(command.code, String(chatId), firstName)
      await sendMessage(String(chatId), device ? welcomeMessage(firstName, device.ownerName) : INVALID_INVITE_MESSAGE)
    } else if (command.command === 'stop') {
      await sendMessage(String(chatId), stoppedMessage(await leaveAll(String(chatId))))
    } else {
      await sendMessage(String(chatId), HELLO_MESSAGE)
    }
  } catch (error) {
    console.error(error)
  }
  // Always 200: otherwise Telegram keeps retrying the same update.
  return new Response('ok')
}
