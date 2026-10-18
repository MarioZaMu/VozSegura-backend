# Voz Segura — Backend

Funciones serverless (Node.js + TypeScript en Vercel) de **Voz Segura**, un botón de
pánico silencioso para smartwatch, caso de estudio de **Diseño de Interfaces de
Software**.

El backend:

1. Recibe la alerta con la ubicación, la guarda y avisa de inmediato a los contactos de
   confianza por un bot de Telegram, con el enlace a la alerta.
2. Recibe después el audio, lo transcribe y genera un resumen breve con IA (Groq) para
   que el contacto tenga contexto sin escuchar todo.

Si la IA falla o no hay conexión, la alerta con ubicación se envía igual: la IA nunca
bloquea ni retrasa la alerta.

El frontend (PWA con las vistas Reloj, Configuración y Contacto) está en
[VozSegura-Frontend](https://github.com/MarioZaMu/VozSegura-Frontend).

## En línea

- **App (PC o celular):** [voz-segura-frontend.vercel.app](https://voz-segura-frontend.vercel.app) · demo de la vista
  Contacto: [voz-segura-frontend.vercel.app/alerta/demo](https://voz-segura-frontend.vercel.app/alerta/demo)
- **API:** [vozsegura-backend.vercel.app/api/health](https://vozsegura-backend.vercel.app/api/health)
- **Bot de Telegram:** [@VSegurabot](https://t.me/VSegurabot) (los contactos se suscriben
  con el enlace de invitación que genera la app)

## Endpoints

| Método | Ruta | Descripción |
| ------ | ---- | ----------- |
| GET | `/api/health` | Estado del servicio |
| POST | `/api/alerts` | Crea la alerta y avisa por Telegram a los contactos confirmados del dispositivo |
| POST | `/api/location` | Agrega una posición |
| POST/GET | `/api/audio` | Sube / reproduce un fragmento de audio |
| POST | `/api/stop` | Cierra la alerta; al terminar la IA se envía el resumen |
| POST | `/api/resolve` | La persona avisa "estoy bien" o "falsa alarma"; se informa una vez a sus contactos |
| GET | `/api/alert?id` | Datos públicos de la alerta (vista Contacto) |
| GET/POST | `/api/device` | Nombre y mensaje personal del dispositivo |
| GET/POST/PUT/DELETE | `/api/contacts` | Contactos de confianza e invitaciones de Telegram |
| POST | `/api/telegram` | Webhook del bot (`/start <código>`, `/stop`) |

### Contactos por invitación

1. En Configuración el usuario agrega un nombre y la app comparte
   `t.me/VSegurabot?start=<código>` (vence en 7 días, un solo uso).
2. El contacto abre el enlace y toca **Iniciar**: el webhook lo marca como confirmado y le
   da la bienvenida.
3. Las alertas de ese dispositivo llegan solo a sus contactos confirmados. Con `/stop` el
   contacto se da de baja.

## Cómo correrlo

Requisitos: Node.js 24.

```bash
npm install
cp .env.example .env   # completa las variables
npm run dev            # http://localhost:3000/api/health
```

```bash
npm run typecheck   # verificación de tipos
npm run lint    # análisis estático con oxlint
npm test        # pruebas unitarias (Vitest)
```

## Cómo desplegarlo (Vercel)

1. En [vercel.com/new](https://vercel.com/new) importa el repo `VozSegura-backend`
   (preset *Other*, sin comando de build).
2. En *Storage* conecta **Upstash Redis** (Marketplace) y **Vercel Blob**; Vercel agrega
   sus variables solo.
3. En *Settings → Environment Variables* agrega `TELEGRAM_BOT_TOKEN`, `GROQ_API_KEY`,
   `ALERT_API_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `ALLOWED_ORIGIN` y `FRONTEND_URL`
   (ver `.env.example`).
4. Cada push a `main` despliega automáticamente.
5. Una sola vez, registra el webhook del bot:
   `npx tsx --env-file=.env scripts/set-webhook.ts`.

## Licencia

Proyecto académico.
