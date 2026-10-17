import { afterEach, beforeEach } from "node:test";

export interface RecordedCall {
  url: string;
  body: unknown;
}

const realFetch = globalThis.fetch;

/**
 * Replaces global fetch with a fake that records Telegram/Groq calls. [respond] decides the
 * response per URL; by default every call succeeds with `{ ok: true }`.
 */
export function useFakeFetch(respond: (url: string) => Response | Promise<Response> = () => okJson({ ok: true })) {
  const calls: RecordedCall[] = [];
  let handler = respond;

  beforeEach(() => {
    calls.length = 0;
    handler = respond;
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      let body: unknown = init?.body;
      if (typeof body === "string") body = JSON.parse(body);
      calls.push({ url, body });
      return handler(url);
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  return {
    calls,
    setResponder(next: (url: string) => Response | Promise<Response>) {
      handler = next;
    },
  };
}

export function okJson(body: unknown): Response {
  return Response.json(body);
}

export function useEnv(values: Record<string, string>) {
  const previous: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const [key, value] of Object.entries(values)) {
      previous[key] = process.env[key];
      process.env[key] = value;
    }
  });
  afterEach(() => {
    for (const key of Object.keys(values)) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });
}

export const TOKEN = "test-token";

export function authedRequest(path: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${TOKEN}`);
  return new Request(`https://example.test${path}`, { method: "POST", ...init, headers });
}

export function jsonBody(value: unknown): RequestInit {
  return { body: JSON.stringify(value), headers: { "content-type": "application/json" } };
}

export const samplePayload = {
  alertId: "c6ff52fe-68b1-4640-a5b6-c5a61eeaecd3",
  createdAtEpochMs: 1792272029169,
  message: "Necesito ayuda. Esta es mi ubicación actual.",
  location: { latitude: 4.711, longitude: -74.0721, accuracyMeters: 5, capturedAtEpochMs: 1792272032910 },
  contactChatIds: ["111"],
};
