// GET    /api/contacts?deviceId=…            — the device's contacts (no chat ids).
// POST   /api/contacts { deviceId, name }     — new contact + Telegram invite link.
// DELETE /api/contacts?deviceId=…&contactId=… — removes a contact.
import { isAlertId as isUuid } from '../lib/alertModel.js'
import { cleanText, inviteUrl, MAX_CONTACTS, MAX_NAME_LENGTH, publicContact } from '../lib/contactModel.js'
import { createContact, getContact, listContacts, removeContact } from '../lib/contactStore.js'
import { errorResponse, isAuthorized, json, preflight, readJsonBody, withCors } from '../lib/http.js'
import { getBotUsername } from '../lib/telegram.js'

async function handleGET(request: Request): Promise<Response> {
  if (!isAuthorized(request)) return errorResponse('Unauthorized', 401)
  const deviceId = new URL(request.url).searchParams.get('deviceId')
  if (!isUuid(deviceId)) return errorResponse('Invalid deviceId', 400)
  const contacts = await listContacts(deviceId)
  return json({ contacts: contacts.map(publicContact) })
}

async function handlePOST(request: Request): Promise<Response> {
  if (!isAuthorized(request)) return errorResponse('Unauthorized', 401)
  const body = await readJsonBody(request)
  if (!body || !isUuid(body.deviceId)) return errorResponse('Invalid deviceId', 400)
  const name = cleanText(body.name, MAX_NAME_LENGTH)
  if (!name) return errorResponse('Invalid name', 400)
  if ((await listContacts(body.deviceId)).length >= MAX_CONTACTS) return errorResponse('Too many contacts', 409)

  const contact = await createContact(body.deviceId, name)
  return json({ contact: publicContact(contact), inviteUrl: inviteUrl(await getBotUsername(), contact.inviteCode) }, 201)
}

/** A new link for a pending contact (e.g. the first one expired or got lost). */
async function handlePUT(request: Request): Promise<Response> {
  if (!isAuthorized(request)) return errorResponse('Unauthorized', 401)
  const body = await readJsonBody(request)
  if (!body || !isUuid(body.deviceId) || !isUuid(body.contactId)) return errorResponse('Invalid ids', 400)
  const old = await getContact(body.deviceId, body.contactId)
  if (!old) return errorResponse('Contact not found', 404)
  await removeContact(body.deviceId, old.id)
  const contact = await createContact(body.deviceId, old.name)
  return json({ contact: publicContact(contact), inviteUrl: inviteUrl(await getBotUsername(), contact.inviteCode) })
}

async function handleDELETE(request: Request): Promise<Response> {
  if (!isAuthorized(request)) return errorResponse('Unauthorized', 401)
  const url = new URL(request.url)
  const deviceId = url.searchParams.get('deviceId')
  const contactId = url.searchParams.get('contactId')
  if (!isUuid(deviceId) || !isUuid(contactId)) return errorResponse('Invalid ids', 400)
  if (!(await removeContact(deviceId, contactId))) return errorResponse('Contact not found', 404)
  return json({ ok: true })
}

export const GET = withCors(handleGET)
export const POST = withCors(handlePOST)
export const PUT = withCors(handlePUT)
export const DELETE = withCors(handleDELETE)
export const OPTIONS = withCors(preflight)
