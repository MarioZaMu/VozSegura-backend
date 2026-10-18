// Environment access. Secrets live only in env vars (Vercel settings or local .env files).

export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable ${name}`)
  return value
}

/** Telegram chats notified for every alert (comma separated). Phase 7 adds per-user contacts. */
export function contactChatIds(): string[] {
  return (process.env.DEFAULT_CHAT_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
}

export function frontendUrl(): string {
  return process.env.FRONTEND_URL ?? 'http://localhost:5173'
}
