// POST /api/location — a new position while the alert is active. Body: { alertId, location }.
// The first position also goes to the contacts as a Telegram map pin.
import { isAlertId, parseLocation } from '../lib/alertModel.js'
import { addLocation, claimOnce, getAlert } from '../lib/alertStore.js'
import { errorResponse, isAuthorized, json, preflight, readJsonBody, withCors } from '../lib/http.js'
import { fallbackChatIds } from '../lib/env.js'
import { sendLocationToAll } from '../lib/telegram.js'

async function handlePOST(request: Request): Promise<Response> {
  if (!isAuthorized(request)) return errorResponse('Unauthorized', 401)
  const body = await readJsonBody(request)
  const fix = parseLocation(body?.location)
  if (!body || !isAlertId(body.alertId) || !fix) return errorResponse('Invalid alertId or location', 400)

  const alert = await getAlert(body.alertId)
  if (!alert) return errorResponse('Alert not found', 404)

  await addLocation(alert.id, fix)
  if (await claimOnce(alert.id, 'firstLocation')) {
    await sendLocationToAll(alert.recipients?.length ? alert.recipients : fallbackChatIds(), fix)
  }
  return json({ ok: true })
}

export const POST = withCors(handlePOST)
export const OPTIONS = withCors(preflight)
