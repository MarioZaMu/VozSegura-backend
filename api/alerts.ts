// POST /api/alerts — the alert itself. Sent by the device right after the double tap.
// Body: { alertId, deviceId?, startedAt?, captureKind?, location? }. Notifies the device's
// confirmed contacts at once (fallback chats if it has none); storage problems never stop
// the Telegram message.
import { alertLink, formatAlertMessage, isAlertId, newAlertRecord, parseCaptureKind, parseLocation } from '../lib/alertModel.js'
import { addLocation, claimOnce, createAlert, getAlert, updateAlert } from '../lib/alertStore.js'
import { confirmedChatIds, getDevice } from '../lib/contactStore.js'
import { fallbackChatIds, frontendUrl } from '../lib/env.js'
import { errorResponse, isAuthorized, json, preflight, readJsonBody, withCors } from '../lib/http.js'
import { sendLocationToAll, sendMessageToAll } from '../lib/telegram.js'

async function handlePOST(request: Request): Promise<Response> {
  if (!isAuthorized(request)) return errorResponse('Unauthorized', 401)
  const body = await readJsonBody(request)
  if (!body || !isAlertId(body.alertId)) return errorResponse('Invalid alertId', 400)

  const alertId = body.alertId
  const deviceId = isAlertId(body.deviceId) ? body.deviceId : null
  const now = Date.now()
  const startedAt = typeof body.startedAt === 'number' && body.startedAt <= now ? body.startedAt : now
  const fix = parseLocation(body.location)
  const link = alertLink(frontendUrl(), alertId)

  let created = false
  let alreadyNotified = false
  let recipients = fallbackChatIds()
  let ownerName = ''
  let message = ''
  try {
    const existing = await getAlert(alertId)
    if (existing) {
      // A retry: keep the recipients chosen the first time.
      alreadyNotified = existing.notified
      if (existing.recipients?.length) recipients = existing.recipients
    } else if (deviceId) {
      const [contacts, device] = await Promise.all([confirmedChatIds(deviceId), getDevice(deviceId)])
      if (contacts.length > 0) recipients = contacts
      ownerName = device?.ownerName ?? ''
      message = device?.message ?? ''
    }
    created = await createAlert(newAlertRecord(alertId, parseCaptureKind(body.captureKind), startedAt, now, deviceId, recipients))
    if (fix) await addLocation(alertId, fix)
  } catch (error) {
    console.error('Alert storage failed, notifying anyway', error)
  }

  let notified = alreadyNotified
  if (!alreadyNotified) {
    notified = (await sendMessageToAll(recipients, formatAlertMessage({ link, startedAt, fix, ownerName, message }))) > 0
    if (notified) await updateAlert(alertId, { notified: true }).catch(console.error)
  }
  if (fix && (await claimOnce(alertId, 'firstLocation').catch(() => true))) {
    await sendLocationToAll(recipients, fix)
  }

  return json({ alertId, link, notified, recipients: recipients.length }, created ? 201 : 200)
}

export const POST = withCors(handlePOST)
export const OPTIONS = withCors(preflight)
