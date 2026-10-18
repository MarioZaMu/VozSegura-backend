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
/** The owner's app language: Telegram messages, transcription hint and AI summary use it. */
export type Language = 'es' | 'en'

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
  /** Missing on alerts created before phase 12 (read as 'es'). */
  language?: Language
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

/** Unknown or missing → Spanish, the original language of the app. */
export function parseLanguage(value: unknown): Language {
  return value === 'en' ? 'en' : 'es'
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
  language: Language = 'es',
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
    language,
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

// ---- Telegram text (owner's language, Telegram HTML parse mode) ----
// The frontend's simulated chat (DemoTelegramPreview) repeats these texts: keep them in sync.

const LOCALES: Record<Language, string> = { es: 'es-CO', en: 'en-US' }

const timeFormats: Record<Language, Intl.DateTimeFormat> = {
  es: new Intl.DateTimeFormat(LOCALES.es, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'America/Bogota' }),
  en: new Intl.DateTimeFormat(LOCALES.en, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'America/Bogota' }),
}

const texts = {
  es: {
    someone: 'Una persona que confía en ti',
    alertTitle: '🚨 <b>Alerta de Voz Segura</b>',
    raised: (who: string, time: string) => `${who} activó una alerta silenciosa a las ${time}.`,
    seeLocation: 'Ver ubicación',
    locationSoon: '📍 La ubicación llegará en unos segundos.',
    followLive: (link: string) => `🔴 <a href="${link}">Seguir la alerta en vivo</a> (audio y resumen)`,
    stopLines: {
      user: '✅ <b>La alerta se detuvo</b> desde el reloj.',
      'max-duration': '✅ <b>La grabación de la alerta terminó</b> (límite de 5 minutos).',
      error: '✅ <b>La grabación de la alerta terminó</b> (se interrumpió en el teléfono).',
    } as Record<StopReason, string>,
    recordingEnded: '✅ <b>La grabación de la alerta terminó.</b>',
    summary: '📝 <b>Resumen del audio</b> (generado por IA, puede tener errores):',
    summaryFailed: '📝 No fue posible generar el resumen del audio. Puedes escucharlo en el enlace.',
    noAudio: '🎙️ No se pudo grabar audio en esta alerta.',
    seeAlert: 'Ver la alerta',
    theOwner: 'La persona que activó la alerta',
    safe: (who: string) => `💚 ${who} avisó que <b>está bien</b>. Gracias por estar pendiente.`,
    falseAlarm: (who: string) => `ℹ️ <b>Falsa alarma:</b> ${who} activó la alerta por error. Todo está bien, no hace falta hacer nada.`,
  },
  en: {
    someone: 'Someone who trusts you',
    alertTitle: '🚨 <b>Voz Segura alert</b>',
    raised: (who: string, time: string) => `${who} raised a silent alert at ${time}.`,
    seeLocation: 'See location',
    locationSoon: '📍 The location will arrive in a few seconds.',
    followLive: (link: string) => `🔴 <a href="${link}">Follow the alert live</a> (audio and summary)`,
    stopLines: {
      user: '✅ <b>The alert was stopped</b> from the watch.',
      'max-duration': '✅ <b>The alert recording ended</b> (5-minute limit).',
      error: '✅ <b>The alert recording ended</b> (it was interrupted on the phone).',
    } as Record<StopReason, string>,
    recordingEnded: '✅ <b>The alert recording ended.</b>',
    summary: '📝 <b>Audio summary</b> (AI-generated, may contain mistakes):',
    summaryFailed: '📝 The audio summary could not be generated. You can listen to it at the link.',
    noAudio: '🎙️ No audio could be recorded in this alert.',
    seeAlert: 'See the alert',
    theOwner: 'The person who raised the alert',
    safe: (who: string) => `💚 ${who} says they are <b>safe</b>. Thanks for looking out.`,
    falseAlarm: (who: string) => `ℹ️ <b>False alarm:</b> ${who} raised the alert by mistake. Everything is fine, nothing to do.`,
  },
}

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
  language?: Language
}): string {
  const language = options.language ?? 'es'
  const t = texts[language]
  const who = options.ownerName ? `<b>${escapeHtml(options.ownerName)}</b>` : t.someone
  const lines = [
    t.alertTitle,
    t.raised(who, timeFormats[language].format(options.startedAt)),
    ...(options.message ? ['', `💬 “${escapeHtml(options.message)}”`] : []),
    '',
    options.fix
      ? `📍 <a href="${mapsUrl(options.fix)}">${t.seeLocation}</a> (±${Math.round(options.fix.accuracy)} m)`
      : t.locationSoon,
    t.followLive(options.link),
  ]
  return lines.join('\n')
}

export function formatFinalMessage(options: {
  link: string
  summary: string | null
  hadAudio: boolean
  stopReason?: StopReason | null
  language?: Language
}): string {
  const t = texts[options.language ?? 'es']
  const body = options.summary
    ? `${t.summary}\n${escapeHtml(options.summary)}`
    : options.hadAudio
      ? t.summaryFailed
      : t.noAudio
  const title = options.stopReason ? t.stopLines[options.stopReason] : t.recordingEnded
  return [title, '', body, '', `🔴 <a href="${options.link}">${t.seeAlert}</a>`].join('\n')
}

/** Sent when the owner marks the alert as "estoy bien" or as a false alarm. */
export function formatResolutionMessage(options: {
  resolution: Resolution
  ownerName?: string
  link: string
  language?: Language
}): string {
  const t = texts[options.language ?? 'es']
  const who = options.ownerName ? `<b>${escapeHtml(options.ownerName)}</b>` : t.theOwner
  const text = options.resolution === 'safe' ? t.safe(who) : t.falseAlarm(who)
  return [text, '', `<a href="${options.link}">${t.seeAlert}</a>`].join('\n')
}
