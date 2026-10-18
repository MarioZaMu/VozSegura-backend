// Devices, contacts and invites in Upstash Redis.
//   device:{id}            hash   DeviceRecord
//   device:{id}:contacts   hash   contactId → ContactRecord
//   invite:{code}          string InviteRecord (expires in 7 days, deleted once used)
//   chat:{chatId}          set    "deviceId:contactId" (for /stop)
import { randomBytes, randomUUID } from 'node:crypto'
import { Redis } from '@upstash/redis'
import {
  INVITE_TTL_SECONDS,
  newContactRecord,
  newDeviceRecord,
  type ContactRecord,
  type DeviceRecord,
  type InviteRecord,
} from './contactModel.js'
import { requireEnv } from './env.js'

let client: Redis | null = null

function redis(): Redis {
  client ??= new Redis({ url: requireEnv('KV_REST_API_URL'), token: requireEnv('KV_REST_API_TOKEN') })
  return client
}

const keys = {
  device: (id: string) => `device:${id}`,
  contacts: (deviceId: string) => `device:${deviceId}:contacts`,
  invite: (code: string) => `invite:${code}`,
  chat: (chatId: string) => `chat:${chatId}`,
}

export async function getDevice(id: string): Promise<DeviceRecord | null> {
  const record = await redis().hgetall<DeviceRecord>(keys.device(id))
  return record && record.id ? record : null
}

/** Returns the device, creating it on first use. */
export async function ensureDevice(id: string): Promise<DeviceRecord> {
  const created = (await redis().hsetnx(keys.device(id), 'id', id)) === 1
  if (created) {
    const record = newDeviceRecord(id, Date.now())
    await redis().hset(keys.device(id), record)
    return record
  }
  return (await getDevice(id)) ?? newDeviceRecord(id, Date.now())
}

export async function updateDevice(id: string, patch: Pick<DeviceRecord, 'ownerName' | 'message'>): Promise<DeviceRecord> {
  await ensureDevice(id)
  await redis().hset(keys.device(id), { ...patch, updatedAt: Date.now() })
  return (await getDevice(id))!
}

export async function listContacts(deviceId: string): Promise<ContactRecord[]> {
  const all = await redis().hgetall<Record<string, ContactRecord>>(keys.contacts(deviceId))
  return all ? Object.values(all).sort((a, b) => a.createdAt - b.createdAt) : []
}

export async function getContact(deviceId: string, contactId: string): Promise<ContactRecord | null> {
  return redis().hget<ContactRecord>(keys.contacts(deviceId), contactId)
}

async function saveContact(deviceId: string, contact: ContactRecord): Promise<void> {
  await redis().hset(keys.contacts(deviceId), { [contact.id]: contact })
}

export async function createContact(deviceId: string, name: string): Promise<ContactRecord> {
  await ensureDevice(deviceId)
  const code = randomBytes(12).toString('base64url') // 16 chars, valid for Telegram ?start=
  const contact = newContactRecord(randomUUID(), name, code, Date.now())
  await saveContact(deviceId, contact)
  const invite: InviteRecord = { deviceId, contactId: contact.id }
  await redis().set(keys.invite(code), invite, { ex: INVITE_TTL_SECONDS })
  return contact
}

export async function removeContact(deviceId: string, contactId: string): Promise<boolean> {
  const contact = await getContact(deviceId, contactId)
  if (!contact) return false
  await redis().hdel(keys.contacts(deviceId), contactId)
  await redis().del(keys.invite(contact.inviteCode))
  if (contact.chatId) await redis().srem(keys.chat(contact.chatId), `${deviceId}:${contactId}`)
  return true
}

/** Links the Telegram chat that opened the invite. Returns the device, or null if invalid. */
export async function acceptInvite(code: string, chatId: string, telegramName: string): Promise<DeviceRecord | null> {
  const invite = await redis().get<InviteRecord>(keys.invite(code))
  if (!invite) return null
  const contact = await getContact(invite.deviceId, invite.contactId)
  if (!contact) return null
  await saveContact(invite.deviceId, { ...contact, status: 'confirmed', chatId, telegramName, confirmedAt: Date.now() })
  await redis().sadd(keys.chat(chatId), `${invite.deviceId}:${invite.contactId}`)
  await redis().del(keys.invite(code))
  return getDevice(invite.deviceId)
}

/** /stop: the chat leaves every device that had it as a contact. Returns how many. */
export async function leaveAll(chatId: string): Promise<number> {
  const members = await redis().smembers(keys.chat(chatId))
  for (const member of members) {
    const [deviceId, contactId] = member.split(':')
    const contact = await getContact(deviceId, contactId)
    if (contact) await saveContact(deviceId, { ...contact, status: 'left', chatId: null })
  }
  await redis().del(keys.chat(chatId))
  return members.length
}

/** Chats that receive this device's alerts. */
export async function confirmedChatIds(deviceId: string): Promise<string[]> {
  return (await listContacts(deviceId)).filter((c) => c.status === 'confirmed' && c.chatId).map((c) => c.chatId!)
}
