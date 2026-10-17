import { optionalEnv, requireEnv } from "./config.js";

const GROQ_API = "https://api.groq.com/openai/v1";
const TIMEOUT_MS = 20_000;
/** Whisper invents text on silence ("gracias por ver el video"); drop segments it flags as non-speech. */
const NO_SPEECH_THRESHOLD = 0.6;

export const NO_SPEECH_SUMMARY = "No se distingue conversación clara en el audio.";

/**
 * The model only gets text, not sound: it cannot hear tone, so the prompt asks it to describe
 * what was said and to stay cautious. It never decides whether to act; contacts do.
 */
const SUMMARY_SYSTEM_PROMPT = [
  "Ayudas a los contactos de confianza de una persona a entender rápido una alerta de seguridad.",
  "Recibirás la transcripción automática (puede tener errores) de 30 segundos de audio grabados por su reloj justo después de que pidió ayuda.",
  "Escribe en español un resumen de máximo 2 frases y 250 caracteres sobre lo que se dice: quién parece hablar, pedidos de ayuda, amenazas, insultos o señales de discusión.",
  "Usa lenguaje prudente (\"se escucha\", \"posible\") y no inventes detalles que no estén en el texto.",
  "No des instrucciones ni digas si hay que actuar.",
  `Si el texto no tiene contenido claro, responde exactamente: "${NO_SPEECH_SUMMARY}"`,
].join(" ");

interface VerboseTranscription {
  text?: string;
  segments?: { text: string; no_speech_prob?: number }[];
}

function authHeader(): Record<string, string> {
  return { authorization: `Bearer ${requireEnv("GROQ_API_KEY")}` };
}

/** Speech-to-text in Spanish. Returns "" when Whisper finds no actual speech. */
export async function transcribe(audio: Blob, filename: string): Promise<string> {
  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", optionalEnv("GROQ_TRANSCRIPTION_MODEL", "whisper-large-v3-turbo"));
  form.append("language", "es");
  form.append("response_format", "verbose_json");
  form.append("temperature", "0");

  const response = await fetch(`${GROQ_API}/audio/transcriptions`, {
    method: "POST",
    headers: authHeader(),
    body: form,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Groq transcription failed with HTTP ${response.status}`);

  const data = (await response.json()) as VerboseTranscription;
  if (data.segments) {
    return data.segments
      .filter((segment) => (segment.no_speech_prob ?? 0) < NO_SPEECH_THRESHOLD)
      .map((segment) => segment.text.trim())
      .join(" ")
      .trim();
  }
  return (data.text ?? "").trim();
}

export async function summarize(transcript: string): Promise<string> {
  if (transcript.length === 0) return NO_SPEECH_SUMMARY;
  const response = await fetch(`${GROQ_API}/chat/completions`, {
    method: "POST",
    headers: { ...authHeader(), "content-type": "application/json" },
    body: JSON.stringify({
      model: optionalEnv("GROQ_SUMMARY_MODEL", "llama-3.3-70b-versatile"),
      temperature: 0.2,
      max_tokens: 150,
      messages: [
        { role: "system", content: SUMMARY_SYSTEM_PROMPT },
        { role: "user", content: `Transcripción:\n"""${transcript}"""` },
      ],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Groq summary failed with HTTP ${response.status}`);

  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const summary = data.choices?.[0]?.message?.content?.trim();
  if (!summary) throw new Error("Groq summary was empty");
  return summary.slice(0, 300);
}
