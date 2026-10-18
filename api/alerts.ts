// POST /api/alerts — the alert itself. Sent by the device right after the double tap.
// Body: { alertId, startedAt?, captureKind?, location? }. Notifies the contacts at once;
// storage problems never stop the Telegram message.
import { alertLink, formatAlertMessage, isAlertId, newAlertRecord, parseCaptureKind, parseLocation } from '../lib/alertModel.js'
import { addLocation, claimOnce, createAlert, getAlert, updateAlert } from '../lib/alertStore.js'
import { frontendUrl } from '../lib/env.js'
import { errorResponse, isAuthorized, json, preflight, readJsonBody } from '../lib/http.js'
import { sendLocationToContacts, sendMessageToContacts } from '../lib/telegram.js'

export async function POST(request: Request): Promise<Response> {
  if (!isAuthorized(request)) return errorResponse('Unauthorized', 401)
  const body = await readJsonBody(request)
  if (!body || !isAlertId(body.alertId)) return errorResponse('Invalid alertId', 400)

  const alertId = body.alertId
  const now = Date.now()
  const startedAt = typeof body.startedAt === 'number' && body.startedAt <= now ? body.startedAt : now
  const fix = parseLocation(body.location)
  const link = alertLink(frontendUrl(), alertId)

  let created = false
  let alreadyNotified = false
  try {
    created = await createAlert(newAlertRecord(alertId, parseCaptureKind(body.captureKind), startedAt, now))
    alreadyNotified = !created && (await getAlert(alertId))?.notified === true
    if (fix) await addLocation(alertId, fix)
  } catch (error) {
    console.error('Alert storage failed, notifying anyway', error)
  }

  let notified = alreadyNotified
  if (!alreadyNotified) {
    notified = (await sendMessageToContacts(formatAlertMessage({ link, startedAt, fix }))) > 0
    if (notified) await updateAlert(alertId, { notified: true }).catch(console.error)
  }
  if (fix && (await claimOnce(alertId, 'firstLocation').catch(() => true))) {
    await sendLocationToContacts(fix)
  }

  return json({ alertId, link, notified }, created ? 201 : 200)
}

export function OPTIONS(): Response {
  return preflight()
}
