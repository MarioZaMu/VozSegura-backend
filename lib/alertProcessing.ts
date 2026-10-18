// Work that runs after responding to the device (waitUntil): transcription, summary and the
// final Telegram message. Every failure is logged and swallowed: the alert already went out.
import { get } from '@vercel/blob'
import {
  alertLink,
  formatFinalMessage,
  isReadyToFinalize,
  orderedTranscript,
  parseLanguage,
  processedChunkCount,
} from './alertModel.js'
import { claimOnce, getAlert, getChunk, getChunks, saveChunk, saveSummaryIfNewer, updateAlert } from './alertStore.js'
import { summarize, transcribe } from './ai.js'
import { fallbackChatIds, frontendUrl } from './env.js'
import { sendMessageToAll } from './telegram.js'

export async function readAudio(pathname: string): Promise<Blob | null> {
  const result = await get(pathname, { access: 'private' })
  if (!result || result.statusCode !== 200) return null
  return new Response(result.stream).blob()
}

async function transcribeChunk(alertId: string, index: number): Promise<void> {
  const [chunk, alert] = await Promise.all([getChunk(alertId, index), getAlert(alertId)])
  if (!chunk || chunk.transcriptStatus === 'done') return
  try {
    const audio = await readAudio(chunk.pathname)
    if (!audio) throw new Error(`Audio not found: ${chunk.pathname}`)
    const transcript = await transcribe(audio, chunk.pathname.split('/').pop() ?? 'chunk.m4a', parseLanguage(alert?.language))
    await saveChunk(alertId, { ...chunk, transcript, transcriptStatus: 'done' })
  } catch (error) {
    console.error(error)
    await saveChunk(alertId, { ...chunk, transcriptStatus: 'error' })
  }
}

async function refreshSummary(alertId: string): Promise<void> {
  const [chunks, alert] = await Promise.all([getChunks(alertId), getAlert(alertId)])
  const transcript = orderedTranscript(chunks)
  if (!transcript) return
  await updateAlert(alertId, { summaryStatus: 'generating' })
  try {
    await saveSummaryIfNewer(alertId, await summarize(transcript, parseLanguage(alert?.language)), processedChunkCount(chunks))
  } catch (error) {
    console.error(error)
    await updateAlert(alertId, { summaryStatus: 'error' })
  }
}

/** Sends the final summary to the contacts once, after the last chunk was processed. */
export async function finalizeIfReady(alertId: string): Promise<void> {
  const [alert, chunks] = await Promise.all([getAlert(alertId), getChunks(alertId)])
  if (!alert || !isReadyToFinalize(alert, chunks)) return
  if (!(await claimOnce(alertId, 'finalMessage'))) return
  if (chunks.length === 0) await updateAlert(alertId, { summaryStatus: 'error' })
  await sendMessageToAll(
    alert.recipients?.length ? alert.recipients : fallbackChatIds(),
    formatFinalMessage({
      link: alertLink(frontendUrl(), alertId),
      summary: alert.summary,
      hadAudio: chunks.length > 0,
      stopReason: alert.stopReason,
      language: parseLanguage(alert.language),
    }),
  )
}

export async function processChunk(alertId: string, index: number): Promise<void> {
  try {
    await transcribeChunk(alertId, index)
    await refreshSummary(alertId)
    await finalizeIfReady(alertId)
  } catch (error) {
    console.error(error)
  }
}
