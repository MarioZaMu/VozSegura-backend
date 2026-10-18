// Groq: Whisper transcription and a short Spanish summary for the trusted contacts.
// The AI only describes the audio; it never decides anything about the alert.
import { requireEnv } from './env.js'

const GROQ_API = 'https://api.groq.com/openai/v1'
const TRANSCRIPTION_MODEL = 'whisper-large-v3-turbo'
const SUMMARY_MODEL = 'openai/gpt-oss-120b'

const SUMMARY_PROMPT = `Eres parte de Voz Segura, un botón de pánico silencioso. Una persona activó una alerta y su teléfono grabó audio. Recibirás la transcripción automática de ese audio (puede tener errores).

Escribe para sus contactos de confianza un resumen en español de máximo 3 frases cortas:
- Qué se escucha y quién parece hablar.
- Señales de peligro concretas si las hay: amenazas, gritos, pedidos de ayuda, nombres, lugares o placas.
- No inventes nada que no esté en la transcripción ni des consejos.
- Ignora frases típicas de errores de transcripción en silencio, como "gracias por ver el video" o "subtítulos realizados por".
- Si no hay contenido útil, responde exactamente: "No se distingue conversación en el audio."`

async function groqFetch(path: string, init: RequestInit): Promise<unknown> {
  const response = await fetch(`${GROQ_API}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${requireEnv('GROQ_API_KEY')}` },
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`Groq ${path} failed: ${response.status} ${await response.text()}`)
  return response.json()
}

export async function transcribe(audio: Blob, filename: string): Promise<string> {
  const form = new FormData()
  form.append('file', audio, filename)
  form.append('model', TRANSCRIPTION_MODEL)
  form.append('language', 'es')
  form.append('temperature', '0')
  form.append('response_format', 'json')
  const result = (await groqFetch('/audio/transcriptions', { method: 'POST', body: form })) as { text?: string }
  return (result.text ?? '').trim()
}

export async function summarize(transcript: string): Promise<string> {
  const result = (await groqFetch('/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: SUMMARY_MODEL,
      temperature: 0.2,
      reasoning_effort: 'low',
      max_completion_tokens: 600,
      messages: [
        { role: 'system', content: SUMMARY_PROMPT },
        { role: 'user', content: `Transcripción:\n${transcript}` },
      ],
    }),
  })) as { choices?: { message?: { content?: string } }[] }
  const summary = result.choices?.[0]?.message?.content?.trim()
  if (!summary) throw new Error('Groq returned an empty summary')
  return summary
}
