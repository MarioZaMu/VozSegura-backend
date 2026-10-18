// POST /api/audio?alertId=…&index=…&durationMs=… — one audio chunk as the raw request body
// (Content-Type audio/mp4 or audio/webm). Stored privately in Vercel Blob; transcription and
// the summary run after responding, so the device can delete its copy right away.
// GET /api/audio?alertId=…&index=… — streams a chunk for the contact view.
import { put } from '@vercel/blob'
import { waitUntil } from '@vercel/functions'
import { isAlertId, MAX_AUDIO_BYTES, parseChunkIndex, type ChunkRecord } from '../lib/alertModel.js'
import { processChunk, readAudio } from '../lib/alertProcessing.js'
import { getAlert, getChunk, saveChunk } from '../lib/alertStore.js'
import { corsHeaders, errorResponse, isAuthorized, json, preflight } from '../lib/http.js'

const EXTENSIONS: Record<string, string> = {
  'audio/mp4': 'm4a',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav', // test clips
}

export async function POST(request: Request): Promise<Response> {
  if (!isAuthorized(request)) return errorResponse('Unauthorized', 401)
  const url = new URL(request.url)
  const alertId = url.searchParams.get('alertId')
  const index = parseChunkIndex(url.searchParams.get('index'))
  if (!isAlertId(alertId) || index === null) return errorResponse('Invalid alertId or index', 400)

  const mimeType = (request.headers.get('content-type') ?? '').split(';')[0].trim()
  const extension = EXTENSIONS[mimeType]
  if (!extension) return errorResponse('Unsupported audio type', 415)

  if (!(await getAlert(alertId))) return errorResponse('Alert not found', 404)

  // A retried upload of a chunk that was already processed is accepted without redoing work.
  const existing = await getChunk(alertId, index)
  if (existing?.transcriptStatus === 'done') return json({ stored: true, duplicate: true })

  const audio = await request.arrayBuffer()
  if (audio.byteLength === 0 || audio.byteLength > MAX_AUDIO_BYTES) return errorResponse('Invalid audio size', 413)

  const pathname = `alerts/${alertId}/chunk-${String(index).padStart(3, '0')}.${extension}`
  await put(pathname, audio, { access: 'private', contentType: mimeType, addRandomSuffix: false, allowOverwrite: true })

  const durationMs = Number(url.searchParams.get('durationMs'))
  const chunk: ChunkRecord = {
    index,
    durationMs: Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 0,
    sizeBytes: audio.byteLength,
    mimeType,
    pathname,
    uploadedAt: Date.now(),
    transcript: null,
    transcriptStatus: 'pending',
  }
  await saveChunk(alertId, chunk)
  waitUntil(processChunk(alertId, index))
  return json({ stored: true }, 201)
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const alertId = url.searchParams.get('alertId')
  const index = parseChunkIndex(url.searchParams.get('index'))
  if (!isAlertId(alertId) || index === null) return errorResponse('Invalid alertId or index', 400)

  const chunk = await getChunk(alertId, index)
  const audio = chunk ? await readAudio(chunk.pathname) : null
  if (!chunk || !audio) return errorResponse('Audio not found', 404)
  return new Response(audio, {
    headers: { ...corsHeaders, 'Content-Type': chunk.mimeType, 'Cache-Control': 'private, max-age=3600' },
  })
}

export function OPTIONS(): Response {
  return preflight()
}
