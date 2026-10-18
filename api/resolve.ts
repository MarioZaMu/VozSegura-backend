// POST /api/resolve — the owner says how the alert ended. Body: { alertId, deviceId, resolution }
// with resolution 'safe' ("estoy bien") or 'false-alarm'. Tells the same contacts once, by
// Telegram, and shows it in the contact view. Only the device that raised the alert may do it.
import { alertLink, formatResolutionMessage, isAlertId, parseLanguage, parseResolution } from '../lib/alertModel.js'
import { claimOnce, getAlert, updateAlert } from '../lib/alertStore.js'
import { getDevice } from '../lib/contactStore.js'
import { fallbackChatIds, frontendUrl } from '../lib/env.js'
import { errorResponse, isAuthorized, json, preflight, readJsonBody, withCors } from '../lib/http.js'
import { sendMessageToAll } from '../lib/telegram.js'

async function handlePOST(request: Request): Promise<Response> {
  if (!isAuthorized(request)) return errorResponse('Unauthorized', 401)
  const body = await readJsonBody(request)
  if (!body || !isAlertId(body.alertId) || !isAlertId(body.deviceId)) return errorResponse('Invalid ids', 400)
  const resolution = parseResolution(body.resolution)
  if (!resolution) return errorResponse('Invalid resolution', 400)

  const alert = await getAlert(body.alertId)
  if (!alert) return errorResponse('Alert not found', 404)
  if (alert.deviceId && alert.deviceId !== body.deviceId) return errorResponse('Forbidden', 403)

  // The first answer wins; repeating it (retries, double taps) never re-sends the message.
  if (!(await claimOnce(alert.id, 'resolution'))) {
    return json({ resolution: alert.resolution ?? resolution, resolvedAt: alert.resolvedAt ?? null })
  }
  const resolvedAt = Date.now()
  await updateAlert(alert.id, { resolution, resolvedAt })

  const device = alert.deviceId ? await getDevice(alert.deviceId).catch(() => null) : null
  await sendMessageToAll(
    alert.recipients?.length ? alert.recipients : fallbackChatIds(),
    formatResolutionMessage({
      resolution,
      ownerName: device?.ownerName,
      link: alertLink(frontendUrl(), alert.id),
      language: parseLanguage(alert.language),
    }),
  )
  return json({ resolution, resolvedAt })
}

export const POST = withCors(handlePOST)
export const OPTIONS = withCors(preflight)
