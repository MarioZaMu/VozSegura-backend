// Environment access. Secrets live only in env vars (Vercel settings or local .env files).

export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable ${name}`)
  return value
}

/**
 * Fallback chats (comma separated) for devices with no confirmed contact yet, so a demo or
 * a fresh install still warns someone. Real users get their own contacts (phase 7).
 */
export function fallbackChatIds(): string[] {
  return (process.env.DEFAULT_CHAT_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
}

export function frontendUrl(): string {
  return process.env.FRONTEND_URL ?? 'http://localhost:5173'
}
