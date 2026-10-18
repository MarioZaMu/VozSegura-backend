// Groq: Whisper transcription and a short summary for the trusted contacts, in the owner's
// language (Spanish or English).
// The AI only describes the audio; it never decides anything about the alert.
import type { Language } from './alertModel.js'
import { requireEnv } from './env.js'

const GROQ_API = 'https://api.groq.com/openai/v1'
const TRANSCRIPTION_MODEL = 'whisper-large-v3-turbo'
const SUMMARY_MODEL = 'openai/gpt-oss-120b'

const SUMMARY_PROMPTS: Record<Language, { system: string; user: (transcript: string) => string }> = {
  es: {
    system: `Eres parte de Voz Segura, un botón de pánico silencioso. Una persona activó una alerta y su teléfono grabó audio. Recibirás la transcripción automática de ese audio (puede tener errores).

Escribe para sus contactos de confianza un resumen en español de máximo 3 frases cortas:
- Qué se escucha y quién parece hablar.
- Señales de peligro concretas si las hay: amenazas, gritos, pedidos de ayuda, nombres, lugares o placas.
- No inventes nada que no esté en la transcripción ni des consejos.
- Ignora frases típicas de errores de transcripción en silencio, como "gracias por ver el video" o "subtítulos realizados por".
- Si no hay contenido útil, responde exactamente: "No se distingue conversación en el audio."`,
    user: (transcript) => `Transcripción:\n${transcript}`,
  },
  en: {
    system: `You are part of Voz Segura, a silent panic button. A person raised an alert and their phone recorded audio. You will get the automatic transcript of that audio (it may contain errors, and the speech may be in any language).

Write for their trusted contacts a summary in English of at most 3 short sentences:
- What can be heard and who seems to be speaking.
- Concrete danger signs if any: threats, shouting, calls for help, names, places or license plates.
- Do not make up anything that is not in the transcript and do not give advice.
- Ignore phrases typical of transcription errors on silence, such as "thanks for watching" or "subtitles by".
- If there is no useful content, answer exactly: "No conversation can be made out in the audio."`,
    user: (transcript) => `Transcript:\n${transcript}`,
  },
}

async function groqFetch(path: string, init: RequestInit): Promise<unknown> {
  const response = await fetch(`${GROQ_API}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${requireEnv('GROQ_API_KEY')}` },
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`Groq ${path} failed: ${response.status} ${await response.text()}`)
  return response.json()
}

/** `language` is only a hint: the owner's app language is usually what is spoken. */
export async function transcribe(audio: Blob, filename: string, language: Language = 'es'): Promise<string> {
  const form = new FormData()
  form.append('file', audio, filename)
  form.append('model', TRANSCRIPTION_MODEL)
  form.append('language', language)
  form.append('temperature', '0')
  form.append('response_format', 'json')
  const result = (await groqFetch('/audio/transcriptions', { method: 'POST', body: form })) as { text?: string }
  return (result.text ?? '').trim()
}

export async function summarize(transcript: string, language: Language = 'es'): Promise<string> {
  const prompt = SUMMARY_PROMPTS[language]
  const result = (await groqFetch('/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: SUMMARY_MODEL,
      temperature: 0.2,
      reasoning_effort: 'low',
      max_completion_tokens: 600,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user(transcript) },
      ],
    }),
  })) as { choices?: { message?: { content?: string } }[] }
  const summary = result.choices?.[0]?.message?.content?.trim()
  if (!summary) throw new Error('Groq returned an empty summary')
  return summary
}
