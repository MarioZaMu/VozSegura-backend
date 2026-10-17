import { isDemoMode } from "../lib/config.js";

/** Liveness + configuration check. Reports only whether each secret is set, never its value. */
export function GET(): Response {
  return Response.json({
    status: "ok",
    service: "voz-segura-backend",
    demoMode: isDemoMode(),
    configured: {
      alertApiToken: Boolean(process.env.ALERT_API_TOKEN),
      telegramBotToken: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      telegramWebhookSecret: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET),
      groqApiKey: Boolean(process.env.GROQ_API_KEY),
      defaultChatIds: Boolean(process.env.DEFAULT_CHAT_IDS),
    },
  });
}
