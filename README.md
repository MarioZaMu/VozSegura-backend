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

## Endpoints

| Método | Ruta          | Descripción         |
| ------ | ------------- | ------------------- |
| GET    | `/api/health` | Estado del servicio |

Los endpoints de alertas se agregan en la fase 7.

## Cómo correrlo

Requisitos: Node.js 20 o superior.

```bash
npm install
cp .env.example .env   # completa las variables
npm run dev            # http://localhost:3000/api/health
```

```bash
npm run build   # verificación de tipos
npm run lint    # análisis estático con oxlint
```

## Cómo desplegarlo (Vercel)

1. En [vercel.com/new](https://vercel.com/new) importa el repo `VozSegura-backend`
   (preset *Other*, sin comando de build).
2. En *Storage* conecta **Upstash Redis** (Marketplace) y **Vercel Blob**; Vercel agrega
   sus variables solo.
3. En *Settings → Environment Variables* agrega `TELEGRAM_BOT_TOKEN`, `GROQ_API_KEY`,
   `ALLOWED_ORIGIN` y `FRONTEND_URL` (ver `.env.example`).
4. Cada push a `main` despliega automáticamente.

## Licencia

Proyecto académico.
