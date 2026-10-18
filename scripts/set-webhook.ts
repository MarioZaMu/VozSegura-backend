// Registers the production webhook with Telegram (run once, or after changing the secret):
//   npx tsx --env-file=.env scripts/set-webhook.ts [https://vozsegura-backend.vercel.app]
// Needs TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET (same value as in Vercel).
const base = process.argv[2] ?? 'https://vozsegura-backend.vercel.app'
const token = process.env.TELEGRAM_BOT_TOKEN
const secret = process.env.TELEGRAM_WEBHOOK_SECRET
if (!token || !secret) throw new Error('TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET are required')

const call = async (method: string, body: Record<string, unknown>) => {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return response.json() as Promise<{ ok: boolean; description?: string; result?: unknown }>
}

console.log('setWebhook:', await call('setWebhook', {
  url: `${base}/api/telegram`,
  secret_token: secret,
  allowed_updates: ['message'],
  drop_pending_updates: true,
}))
console.log('setMyCommands:', await call('setMyCommands', {
  commands: [{ command: 'stop', description: 'Dejar de recibir alertas' }],
}))
const info = (await call('getWebhookInfo', {})).result as { url?: string; pending_update_count?: number; last_error_message?: string }
console.log('webhook:', { url: info.url, pending: info.pending_update_count, lastError: info.last_error_message ?? null })
