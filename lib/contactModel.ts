// Devices (one per phone/browser that can raise alerts) and their trusted contacts, who
// join through a Telegram invite link. Pure helpers only; unit tested in contactModel.test.ts.
import { escapeHtml } from './alertModel.js'

export type DeviceRecord = {
  id: string
  /** Shown to the contacts ("Ana activó una alerta"). Empty until the user sets it. */
  ownerName: string
  /** Optional personal message added to every alert. */
  message: string
  createdAt: number
  updatedAt: number
}

/** pending: invite not opened yet · confirmed: receives alerts · left: unsubscribed with /stop */
export type ContactStatus = 'pending' | 'confirmed' | 'left'

export type ContactRecord = {
  id: string
  name: string
  status: ContactStatus
  inviteCode: string
  chatId: string | null
  telegramName: string | null
  createdAt: number
  confirmedAt: number | null
}

export type InviteRecord = { deviceId: string; contactId: string }

export const MAX_CONTACTS = 10
export const MAX_NAME_LENGTH = 40
export const MAX_MESSAGE_LENGTH = 280
export const INVITE_TTL_SECONDS = 60 * 60 * 24 * 7

const INVITE_CODE = /^[A-Za-z0-9_-]{8,64}$/

/** Trims and collapses whitespace; null when empty or too long. */
export function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const text = value.replace(/\s+/g, ' ').trim()
  return text.length > 0 && text.length <= maxLength ? text : null
}

export function newDeviceRecord(id: string, now: number): DeviceRecord {
  return { id, ownerName: '', message: '', createdAt: now, updatedAt: now }
}

export function newContactRecord(id: string, name: string, inviteCode: string, now: number): ContactRecord {
  return { id, name, status: 'pending', inviteCode, chatId: null, telegramName: null, createdAt: now, confirmedAt: null }
}

/** Public view of a contact for the app: no chat id or invite code inside. */
export function publicContact(contact: ContactRecord) {
  const { id, name, status, telegramName, createdAt, confirmedAt } = contact
  return { id, name, status, telegramName, createdAt, confirmedAt }
}

export function inviteUrl(botUsername: string, code: string): string {
  return `https://t.me/${botUsername}?start=${code}`
}

export type BotCommand = { command: 'start'; code: string | null } | { command: 'stop' } | { command: 'other' }

/** Parses "/start <code>", "/start", "/stop" (also "/start@BotName <code>"). */
export function parseBotCommand(text: unknown): BotCommand {
  if (typeof text !== 'string') return { command: 'other' }
  const [head, argument] = text.trim().split(/\s+/, 2)
  const command = head?.split('@')[0].toLowerCase()
  if (command === '/start') return { command: 'start', code: argument && INVITE_CODE.test(argument) ? argument : null }
  if (command === '/stop') return { command: 'stop' }
  return { command: 'other' }
}

// ---- Bot replies (Spanish, Telegram HTML) ----

export function welcomeMessage(contactFirstName: string, ownerName: string): string {
  const owner = ownerName ? `<b>${escapeHtml(ownerName)}</b>` : 'la persona que te invitó'
  return [
    `✅ Listo${contactFirstName ? `, ${escapeHtml(contactFirstName)}` : ''}. Ahora eres contacto de confianza de ${owner} en Voz Segura.`,
    '',
    'Si activa una alerta silenciosa, aquí recibirás su ubicación, un enlace para seguirla en vivo y un resumen del audio.',
    '',
    'Si en algún momento no quieres recibir más alertas, escribe /stop.',
  ].join('\n')
}

export const INVALID_INVITE_MESSAGE =
  'Este enlace de invitación ya no es válido (vence a los 7 días o ya se usó). Pide a tu contacto que te envíe uno nuevo desde Voz Segura.'

export const HELLO_MESSAGE =
  '👋 Este es el bot de Voz Segura. Para recibir las alertas de alguien, abre el enlace de invitación que te envió.'

export function stoppedMessage(count: number): string {
  return count > 0
    ? 'Listo, ya no recibirás más alertas. Si cambias de opinión, pide una nueva invitación.'
    : 'No tienes alertas activas en este chat.'
}
