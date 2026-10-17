# Voz Segura — Backend

Función serverless (Vercel + Node.js + TypeScript) para **Voz Segura**, botón de pánico silencioso
para Wear OS. Recibe la ubicación y el audio desde el reloj, avisa a los contactos de confianza por
Telegram y, en segundo plano, transcribe y resume el audio con IA (Groq).

App Android: [VozSegura-android](https://github.com/MarioZaMu/VozSegura-android)

## Endpoints

| Método | Ruta          | Descripción                                   |
|--------|---------------|-----------------------------------------------|
| GET    | `/api/health` | Verifica que el servicio esté arriba.         |
| POST   | `/api/alert`  | Recibe una alerta (stub en la fase 1).        |

## Principio de diseño

La alerta con ubicación se envía **primero**. La IA solo agrega contexto después; si falla o no hay
respuesta, la alerta ya llegó.

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # completar valores
npm run dev                  # http://localhost:3000/api/health
```

## Variables de entorno

Ver `.env.example`. Las claves se configuran en Vercel (Settings → Environment Variables), nunca en
el repositorio ni dentro de las apps.
