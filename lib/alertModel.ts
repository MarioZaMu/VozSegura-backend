// Alert data types and pure helpers (validation, ordering, message text). No I/O here so
// it is unit tested in alertModel.test.ts.

export type LocationFix = { latitude: number; longitude: number; accuracy: number; time: number }
export type CaptureKind = 'demo' | 'web' | 'native'
export type AlertStatus = 'active' | 'stopped'
export type StopReason = 'user' | 'max-duration' | 'error'
export type SummaryStatus = 'waiting' | 'generating' | 'ready' | 'error'
export type TranscriptStatus = 'pending' | 'done' | 'error'
/** Set by the owner afterwards: 'safe' = "estoy bien", 'false-alarm' = activated by mistake. */
export type Resolution = 'safe' | 'false-alarm'

export type AlertRecord = {
  id: string
  /** Phone/browser that raised it (null for alerts from before devices existed). */
  deviceId: string | null
  /** Telegram chats chosen when the alert started; later messages go to the same ones. */
  recipients: string[]
  status: AlertStatus
  captureKind: CaptureKind
  startedAt: number
  createdAt: number
  notified: boolean
  stoppedAt: number | null
  stopReason: StopReason | null
  /** Sent by the device when it stops, so the server knows when every chunk has arrived. */
  totalChunks: number | null
  lastLocation: LocationFix | null
  summary: string | null
  /** How many processed chunks the current summary covers (an older summary never wins). */
  summaryChunks: number
  summaryStatus: SummaryStatus
  summaryUpdatedAt: number | null
  /** Missing on alerts created before phase 10 (read as null). */
  resolution?: Resolution | null
  resolvedAt?: number | null
}

export type ChunkRecord = {
  index: number
  durationMs: number
  sizeBytes: number
  mimeType: string
  pathname: string
  uploadedAt: number
  transcript: string | null
  transcriptStatus: TranscriptStatus
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CAPTURE_KINDS: CaptureKind[] = ['demo', 'web', 'native']
const STOP_REASONS: StopReason[] = ['user', 'max-duration', 'error']
const RESOLUTIONS: Resolution[] = ['safe', 'false-alarm']

export const MAX_CHUNK_INDEX = 999
export const MAX_AUDIO_BYTES = 4 * 1024 * 1024 // Vercel rejects bodies over 4.5 MB

export function isAlertId(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value)
}

export function parseCaptureKind(value: unknown): CaptureKind {
  return CAPTURE_KINDS.includes(value as CaptureKind) ? (value as CaptureKind) : 'web'
}

export function parseStopReason(value: unknown): StopReason {
  return STOP_REASONS.includes(value as StopReason) ? (value as StopReason) : 'user'
}

export function parseResolution(value: unknown): Resolution | null {
  return RESOLUTIONS.includes(value as Resolution) ? (value as Resolution) : null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function parseLocation(value: unknown): LocationFix | null {
  if (!value || typeof value !== 'object') return null
  const { latitude, longitude, accuracy, time } = value as Record<string, unknown>
  if (!isFiniteNumber(latitude) || latitude < -90 || latitude > 90) return null
  if (!isFiniteNumber(longitude) || longitude < -180 || longitude > 180) return null
  return {
    latitude,
    longitude,
    accuracy: isFiniteNumber(accuracy) && accuracy >= 0 ? accuracy : 0,
    time: isFiniteNumber(time) ? time : Date.now(),
  }
}

export function parseChunkIndex(value: string | null): number | null {
  if (value === null || !/^\d{1,3}$/.test(value)) return null
  const index = Number(value)
  return index <= MAX_CHUNK_INDEX ? index : null
}

export function newAlertRecord(
  id: string,
  captureKind: CaptureKind,
  startedAt: number,
  now: number,
  deviceId: string | null = null,
  recipients: string[] = [],
): AlertRecord {
  return {
    id,
    deviceId,
    recipients,
    status: 'active',
    captureKind,
    startedAt,
    createdAt: now,
    notified: false,
    stoppedAt: null,
    stopReason: null,
    totalChunks: null,
    lastLocation: null,
    summary: null,
    summaryChunks: 0,
    summaryStatus: 'waiting',
    summaryUpdatedAt: null,
    resolution: null,
    resolvedAt: null,
  }
}

/** Processed transcripts in recording order, ready for the summary prompt. */
export function orderedTranscript(chunks: ChunkRecord[]): string {
  return [...chunks]
    .sort((a, b) => a.index - b.index)
    .filter((chunk) => chunk.transcriptStatus === 'done' && chunk.transcript)
    .map((chunk) => chunk.transcript)
    .join(' ')
    .trim()
}

export function processedChunkCount(chunks: ChunkRecord[]): number {
  return chunks.filter((chunk) => chunk.transcriptStatus !== 'pending').length
}

/** The final summary goes out once the alert stopped and every announced chunk was processed. */
export function isReadyToFinalize(alert: AlertRecord, chunks: ChunkRecord[]): boolean {
  if (alert.status !== 'stopped' || alert.totalChunks === null) return false
  return processedChunkCount(chunks) >= alert.totalChunks
}

// ---- Telegram text (Spanish, Telegram HTML parse mode) ----

const timeFormat = new Intl.DateTimeFormat('es-CO', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'America/Bogota',
})

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function mapsUrl(fix: LocationFix): string {
  return `https://maps.google.com/?q=${fix.latitude.toFixed(6)},${fix.longitude.toFixed(6)}`
}

export function alertLink(frontendUrl: string, alertId: string): string {
  return `${frontendUrl.replace(/\/+$/, '')}/alerta/${alertId}`
}

export function formatAlertMessage(options: {
  link: string
  startedAt: number
  fix: LocationFix | null
  ownerName?: string
  message?: string
}): string {
  const who = options.ownerName ? `<b>${escapeHtml(options.ownerName)}</b>` : 'Una persona que confía en ti'
  const lines = [
    '🚨 <b>Alerta de Voz Segura</b>',
    `${who} activó una alerta silenciosa a las ${timeFormat.format(options.startedAt)}.`,
    ...(options.message ? ['', `💬 “${escapeHtml(options.message)}”`] : []),
    '',
    options.fix
      ? `📍 <a href="${mapsUrl(options.fix)}">Ver ubicación</a> (±${Math.round(options.fix.accuracy)} m)`
      : '📍 La ubicación llegará en unos segundos.',
    `🔴 <a href="${options.link}">Seguir la alerta en vivo</a> (audio y resumen)`,
  ]
  return lines.join('\n')
}

const stopLines: Record<StopReason, string> = {
  user: '✅ <b>La alerta se detuvo</b> desde el reloj.',
  'max-duration': '✅ <b>La grabación de la alerta terminó</b> (límite de 5 minutos).',
  error: '✅ <b>La grabación de la alerta terminó</b> (se interrumpió en el teléfono).',
}

export function formatFinalMessage(options: {
  link: string
  summary: string | null
  hadAudio: boolean
  stopReason?: StopReason | null
}): string {
  const body = options.summary
    ? `📝 <b>Resumen del audio</b> (generado por IA, puede tener errores):\n${escapeHtml(options.summary)}`
    : options.hadAudio
      ? '📝 No fue posible generar el resumen del audio. Puedes escucharlo en el enlace.'
      : '🎙️ No se pudo grabar audio en esta alerta.'
  const title = options.stopReason ? stopLines[options.stopReason] : '✅ <b>La grabación de la alerta terminó.</b>'
  return [title, '', body, '', `🔴 <a href="${options.link}">Ver la alerta</a>`].join('\n')
}

/** Sent when the owner marks the alert as "estoy bien" or as a false alarm. */
export function formatResolutionMessage(options: { resolution: Resolution; ownerName?: string; link: string }): string {
  const who = options.ownerName ? `<b>${escapeHtml(options.ownerName)}</b>` : 'La persona que activó la alerta'
  const text =
    options.resolution === 'safe'
      ? `💚 ${who} avisó que <b>está bien</b>. Gracias por estar pendiente.`
      : `ℹ️ <b>Falsa alarma:</b> ${who} activó la alerta por error. Todo está bien, no hace falta hacer nada.`
  return [text, '', `<a href="${options.link}">Ver la alerta</a>`].join('\n')
}
