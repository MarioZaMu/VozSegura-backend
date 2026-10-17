import { alertTimeZone } from "./config.js";
import type { AlertPayload } from "./payload.js";

/** Telegram HTML parse mode only needs these three escaped. */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatTime(epochMs: number): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: alertTimeZone(),
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(epochMs));
}

export function mapsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

export function alertText(payload: AlertPayload): string {
  const lines = [
    "🚨 <b>Alerta de Voz Segura</b>",
    escapeHtml(payload.message),
    "",
    `🕒 ${formatTime(payload.createdAtEpochMs)}`,
  ];
  const location = payload.location;
  if (location) {
    const accuracy = location.accuracyMeters ? ` (±${Math.round(location.accuracyMeters)} m)` : "";
    lines.push(`📍 <a href="${mapsUrl(location.latitude, location.longitude)}">Ver ubicación en el mapa</a>${accuracy}`);
  } else {
    lines.push("📍 Ubicación no disponible todavía");
  }
  lines.push("", "<i>En unos segundos llegará un resumen del audio.</i>");
  return lines.join("\n");
}

export function summaryText(summary: string): string {
  return [
    "🧠 <b>Resumen automático del audio</b>",
    escapeHtml(summary),
    "",
    "<i>Generado por IA a partir de una transcripción: puede contener errores. Escucha el audio si tienes dudas.</i>",
  ].join("\n");
}

export const SUMMARY_UNAVAILABLE_TEXT =
  "🎙️ <b>Audio de la alerta</b>\nNo se pudo generar el resumen automático. Escucha el audio adjunto.";

export const AUDIO_CAPTION = "🎙️ Audio grabado por el reloj (30 s)";

export const CANCELLATION_TEXT =
  "✅ <b>Alerta cancelada</b>\nLa persona indicó que está bien.";

export function startReplyText(chatId: string): string {
  return [
    "Hola 👋 Soy el bot de <b>Voz Segura</b>.",
    "Para que te agreguen como contacto de confianza, comparte este código:",
    `<code>${escapeHtml(chatId)}</code>`,
    "",
    "Si esa persona activa una alerta, te llegará aquí su ubicación y un resumen del audio.",
  ].join("\n");
}
