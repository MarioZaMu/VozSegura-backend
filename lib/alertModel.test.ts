import { describe, expect, it } from 'vitest'
import {
  alertLink,
  escapeHtml,
  formatAlertMessage,
  formatFinalMessage,
  formatResolutionMessage,
  parseResolution,
  isAlertId,
  isReadyToFinalize,
  newAlertRecord,
  orderedTranscript,
  parseChunkIndex,
  parseLocation,
  type ChunkRecord,
} from './alertModel.js'

const ID = '3f2b8c1e-9a4d-4e2f-8b6a-1c2d3e4f5a6b'

const chunk = (index: number, transcriptStatus: ChunkRecord['transcriptStatus'], transcript: string | null = null): ChunkRecord => ({
  index,
  durationMs: 20_000,
  sizeBytes: 80_000,
  mimeType: 'audio/mp4',
  pathname: `alerts/${ID}/chunk-${index}.m4a`,
  uploadedAt: 0,
  transcript,
  transcriptStatus,
})

describe('validation', () => {
  it('accepts only UUID alert ids', () => {
    expect(isAlertId(ID)).toBe(true)
    expect(isAlertId('../../etc')).toBe(false)
    expect(isAlertId(42)).toBe(false)
  })

  it('validates locations and fills optional fields', () => {
    expect(parseLocation({ latitude: 6.2, longitude: -75.5 })).toMatchObject({ latitude: 6.2, longitude: -75.5, accuracy: 0 })
    expect(parseLocation({ latitude: 91, longitude: 0 })).toBeNull()
    expect(parseLocation({ latitude: '6', longitude: 0 })).toBeNull()
    expect(parseLocation(null)).toBeNull()
  })

  it('parses chunk indexes in range only', () => {
    expect(parseChunkIndex('7')).toBe(7)
    expect(parseChunkIndex('-1')).toBeNull()
    expect(parseChunkIndex('1000')).toBeNull()
    expect(parseChunkIndex(null)).toBeNull()
  })
})

describe('transcript and finalization', () => {
  it('joins finished transcripts in recording order', () => {
    const chunks = [chunk(2, 'done', 'tres'), chunk(0, 'done', 'uno'), chunk(1, 'error')]
    expect(orderedTranscript(chunks)).toBe('uno tres')
  })

  it('waits for every announced chunk before the final message', () => {
    const alert = { ...newAlertRecord(ID, 'native', 0, 0), status: 'stopped' as const, totalChunks: 2 }
    expect(isReadyToFinalize(alert, [chunk(0, 'done', 'a')])).toBe(false)
    expect(isReadyToFinalize(alert, [chunk(0, 'done', 'a'), chunk(1, 'pending')])).toBe(false)
    expect(isReadyToFinalize(alert, [chunk(0, 'done', 'a'), chunk(1, 'error')])).toBe(true)
  })

  it('never finalizes an active alert', () => {
    expect(isReadyToFinalize({ ...newAlertRecord(ID, 'web', 0, 0), totalChunks: 0 }, [])).toBe(false)
  })
})

describe('telegram text', () => {
  it('builds the contact link without double slashes', () => {
    expect(alertLink('https://voz.app/', ID)).toBe(`https://voz.app/alerta/${ID}`)
  })

  it('mentions the location when there is one', () => {
    const fix = { latitude: 6.2442, longitude: -75.5812, accuracy: 12, time: 0 }
    expect(formatAlertMessage({ link: 'L', startedAt: 0, fix })).toContain('maps.google.com/?q=6.244200,-75.581200')
    expect(formatAlertMessage({ link: 'L', startedAt: 0, fix: null })).toContain('llegará en unos segundos')
  })

  it('escapes the AI summary for Telegram HTML', () => {
    expect(escapeHtml('<b>&')).toBe('&lt;b&gt;&amp;')
    expect(formatFinalMessage({ link: 'L', summary: 'Grita <ayuda>', hadAudio: true })).toContain('Grita &lt;ayuda&gt;')
    expect(formatFinalMessage({ link: 'L', summary: null, hadAudio: false })).toContain('No se pudo grabar audio')
    expect(formatFinalMessage({ link: 'L', summary: 'x', hadAudio: true, stopReason: 'user' })).toContain('se detuvo')
    expect(formatFinalMessage({ link: 'L', summary: 'x', hadAudio: true, stopReason: 'max-duration' })).toContain('5 minutos')
  })
})

describe('resolution', () => {
  it('accepts only known resolutions', () => {
    expect(parseResolution('safe')).toBe('safe')
    expect(parseResolution('false-alarm')).toBe('false-alarm')
    expect(parseResolution('cancel')).toBeNull()
  })

  it('tells the contacts the owner is safe or it was a false alarm', () => {
    expect(formatResolutionMessage({ resolution: 'safe', ownerName: 'Ana <3', link: 'L' })).toContain('<b>Ana &lt;3</b> avisó que <b>está bien</b>')
    expect(formatResolutionMessage({ resolution: 'false-alarm', link: 'L' })).toContain('Falsa alarma')
  })
})
