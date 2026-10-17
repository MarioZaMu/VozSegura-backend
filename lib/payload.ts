/** Mirrors `com.vozsegura.shared.model.AlertPayload` in the Android repo. Keep both in sync. */
export interface AlertLocation {
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  capturedAtEpochMs: number;
}

export interface AlertPayload {
  alertId: string;
  createdAtEpochMs: number;
  message: string;
  location?: AlertLocation | null;
  /** Telegram chat ids of the trusted contacts configured on the phone. */
  contactChatIds?: string[];
}

export interface CancelPayload {
  alertId: string;
  contactChatIds?: string[];
}

const MAX_MESSAGE_LENGTH = 500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseChatIds(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return undefined;
  return value.filter((id): id is string => typeof id === "string");
}

function parseLocation(value: unknown): AlertLocation | null {
  if (!isRecord(value)) return null;
  const { latitude, longitude, accuracyMeters, capturedAtEpochMs } = value;
  if (!isFiniteNumber(latitude) || latitude < -90 || latitude > 90) return null;
  if (!isFiniteNumber(longitude) || longitude < -180 || longitude > 180) return null;
  if (!isFiniteNumber(capturedAtEpochMs)) return null;
  return {
    latitude,
    longitude,
    accuracyMeters: isFiniteNumber(accuracyMeters) ? accuracyMeters : null,
    capturedAtEpochMs,
  };
}

/** Returns a validated payload, or null. An invalid location is dropped, never fatal. */
export function parseAlertPayload(value: unknown): AlertPayload | null {
  if (!isRecord(value)) return null;
  const { alertId, createdAtEpochMs, message, location, contactChatIds } = value;
  if (typeof alertId !== "string" || alertId.length === 0 || alertId.length > 64) return null;
  if (!isFiniteNumber(createdAtEpochMs)) return null;
  if (typeof message !== "string") return null;
  return {
    alertId,
    createdAtEpochMs,
    message: message.slice(0, MAX_MESSAGE_LENGTH),
    location: parseLocation(location),
    contactChatIds: parseChatIds(contactChatIds),
  };
}

export function parseCancelPayload(value: unknown): CancelPayload | null {
  if (!isRecord(value)) return null;
  const { alertId, contactChatIds } = value;
  if (typeof alertId !== "string" || alertId.length === 0 || alertId.length > 64) return null;
  return { alertId, contactChatIds: parseChatIds(contactChatIds) };
}
