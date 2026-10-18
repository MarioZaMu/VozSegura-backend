# Voz Segura — Backend

Función serverless (Vercel + Node.js + TypeScript) para **Voz Segura**, botón de pánico silencioso
para Wear OS. Recibe la alerta desde el reloj, avisa a los contactos de confianza por Telegram y,
aparte, transcribe y resume el audio con IA (Groq).

App Android: [VozSegura-android](https://github.com/MarioZaMu/VozSegura-android)

## Caso de estudio

📄 **[Documento completo (PDF)](docs/Voz-Segura-Caso-de-estudio.pdf)**: problema, usuarios,
arquitectura, estados de la alerta, diseño de interfaz, uso de IA y sus límites, privacidad,
accesibilidad, pruebas, limitaciones y guion de la demo. Caso de estudio para la materia
**Diseño de Interfaces de Software**.

## Flujo de una alerta

1. `POST /api/alert` — mensaje, hora y ubicación a cada contacto. **Sin IA**: nada puede retrasarlo.
2. `POST /api/audio` — clip de 30 s → transcripción (Whisper) → resumen (Llama) → resumen + audio
   a cada contacto. Si la IA falla, se envía el audio igual.
3. `POST /api/cancel` — "Alerta cancelada: la persona indicó que está bien".

La IA **nunca decide** si hay peligro ni cuándo alertar: solo resume lo que se dice para que los
contactos tengan contexto inmediato.

## Endpoints

| Método | Ruta             | Auth                      | Descripción                                   |
|--------|------------------|---------------------------|-----------------------------------------------|
| GET    | `/api/health`    | —                         | Estado y qué variables están configuradas.    |
| POST   | `/api/alert`     | `Bearer ALERT_API_TOKEN`  | JSON `AlertPayload` (ver `lib/payload.ts`).   |
| POST   | `/api/audio`     | `Bearer ALERT_API_TOKEN`  | Cuerpo `audio/mp4`; `?alertId=…&chatIds=…`.   |
| POST   | `/api/cancel`    | `Bearer ALERT_API_TOKEN`  | JSON `{ alertId, contactChatIds }`.           |
| POST   | `/api/telegram`  | secreto del webhook       | Responde `/start` con el código del contacto. |

Modo demo: `DEMO_MODE=true` (todo el servidor) o el header `X-Demo-Mode: true` (una petición)
simulan Telegram y Groq.

## Desarrollo local

```bash
npm install
npm test            # pruebas con Telegram y Groq simulados
npm run typecheck
```

## Despliegue (una vez)

1. Crear el bot: en Telegram, hablar con **@BotFather** → `/newbot` → guardar el token.
2. `npx vercel login` y luego `npx vercel link` (proyecto nuevo `voz-segura-backend`).
3. Cargar las variables (cada comando pide el valor; no quedan en el historial):
   ```bash
   npx vercel env add ALERT_API_TOKEN production
   npx vercel env add TELEGRAM_BOT_TOKEN production
   npx vercel env add TELEGRAM_WEBHOOK_SECRET production
   npx vercel env add GROQ_API_KEY production
   ```
4. `npx vercel --prod` → anotar la URL (`https://<proyecto>.vercel.app`).
5. Registrar el webhook del bot (reemplazar los valores):
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<proyecto>.vercel.app/api/telegram&secret_token=<WEBHOOK_SECRET>"
   ```
6. Cada contacto abre el bot y envía `/start`; el bot le responde su código (chat id).

## Variables de entorno

Ver `.env.example`. Las claves viven solo en Vercel (Settings → Environment Variables), nunca en el
repositorio ni dentro de las apps.
