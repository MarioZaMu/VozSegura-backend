// POST /api/stop — the recording ended. Body: { alertId, reason?, totalChunks }.
// totalChunks tells the server when the last chunk has been processed, so the final summary
// is sent to the contacts exactly once (even if the last upload arrives after this request).
import { waitUntil } from '@vercel/functions'
import { isAlertId, MAX_CHUNK_INDEX, parseStopReason } from '../lib/alertModel.js'
import { finalizeIfReady } from '../lib/alertProcessing.js'
import { getAlert, updateAlert } from '../lib/alertStore.js'
import { errorResponse, isAuthorized, json, preflight, readJsonBody } from '../lib/http.js'

export async function POST(request: Request): Promise<Response> {
  if (!isAuthorized(request)) return errorResponse('Unauthorized', 401)
  const body = await readJsonBody(request)
  if (!body || !isAlertId(body.alertId)) return errorResponse('Invalid alertId', 400)
  const totalChunks = body.totalChunks
  if (typeof totalChunks !== 'number' || !Number.isInteger(totalChunks) || totalChunks < 0 || totalChunks > MAX_CHUNK_INDEX + 1) {
    return errorResponse('Invalid totalChunks', 400)
  }

  const alert = await getAlert(body.alertId)
  if (!alert) return errorResponse('Alert not found', 404)

  if (alert.status !== 'stopped') {
    await updateAlert(alert.id, { status: 'stopped', stoppedAt: Date.now(), stopReason: parseStopReason(body.reason), totalChunks })
  }
  waitUntil(finalizeIfReady(alert.id).catch(console.error))
  return json({ ok: true })
}

export function OPTIONS(): Response {
  return preflight()
}
