// GET /api/alert?id=… — what the trusted contact sees (phase 9 view polls it).
// Public on purpose: the alert id is a random UUID that only reaches the contacts.
import { isAlertId } from '../lib/alertModel.js'
import { getAlert, getChunks, getLocations } from '../lib/alertStore.js'
import { getDevice } from '../lib/contactStore.js'
import { errorResponse, json, preflight, withCors } from '../lib/http.js'

async function handleGET(request: Request): Promise<Response> {
  const id = new URL(request.url).searchParams.get('id')
  if (!isAlertId(id)) return errorResponse('Invalid id', 400)

  const [alert, locations, chunks] = await Promise.all([getAlert(id), getLocations(id), getChunks(id)])
  if (!alert) return errorResponse('Alert not found', 404)
  // Same name and message the contacts already got in the Telegram alert.
  const device = alert.deviceId ? await getDevice(alert.deviceId).catch(() => null) : null

  return json({
    id: alert.id,
    status: alert.status,
    ownerName: device?.ownerName ?? '',
    message: device?.message ?? '',
    startedAt: alert.startedAt,
    stoppedAt: alert.stoppedAt,
    stopReason: alert.stopReason,
    lastLocation: alert.lastLocation,
    locations,
    summary: alert.summary,
    summaryStatus: alert.summaryStatus,
    summaryUpdatedAt: alert.summaryUpdatedAt,
    resolution: alert.resolution ?? null,
    resolvedAt: alert.resolvedAt ?? null,
    chunks: chunks.map(({ index, durationMs, transcript, transcriptStatus }) => ({
      index,
      durationMs,
      transcript,
      transcriptStatus,
      audioPath: `/api/audio?alertId=${id}&index=${index}`,
    })),
  })
}

export const GET = withCors(handleGET)
export const OPTIONS = withCors(preflight)
