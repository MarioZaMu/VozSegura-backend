# Voz Segura — Backend (Vercel serverless)

Backend for Voz Segura, a silent panic button (course case study for "Diseño de
Interfaces de Software"). The PWA frontend lives in `../VozSegura-Frontend`
(github.com/MarioZaMu/VozSegura-Frontend). This repo receives the alert (location, then
audio), stores it, notifies trusted contacts through a Telegram bot, and transcribes +
summarizes the audio with AI (Groq).

## Working rules

- **Language:** all code, comments and commits in English. User-facing text (Telegram
  messages, AI summaries) in Spanish.
- Work in phases; explain before, report after and wait for approval. Each phase ends
  with `npm run build` + `npm run lint` clean and several small commits. Never push
  unless asked.
- Commits authored as MarioZaMu only, no `Co-Authored-By` trailers.
- Secrets (Groq key, Telegram token) only in env variables, never in code or frontend.
- Keep this file updated with every decision.

## Commands

```bash
npm install
npm run dev     # local server (scripts/dev-server.ts) at http://localhost:3000, loads .env
npm run build   # type-check with tsc (Vercel compiles the functions itself)
npm run lint    # oxlint
```

## Structure

```
api/        one file per endpoint; export GET/POST/OPTIONS Web handlers (Request → Response)
lib/        shared code (http/CORS helpers, storage, telegram, ai…)
scripts/    dev-server.ts: runs api/ locally, /api/<name> → api/<name>.ts
```

ESM with `module: nodenext`: relative imports must end in `.js` (e.g. `'../lib/http.js'`).

## Endpoints

| Method | Path          | Status  | Purpose      |
| ------ | ------------- | ------- | ------------ |
| GET    | `/api/health` | ✅      | Health check |

Planned for phase 7: `POST /api/alerts` (location → store + Telegram + link),
`POST /api/alerts/audio` (audio → transcription + summary), `GET /api/alerts/:id`
(contact view), cancel endpoint (false alarm), Telegram webhook for contact subscription.

## Decisions

- **Alert in two requests:** the location request alone stores the alert, sends Telegram
  and returns the link. Audio arrives later and only then the AI runs. AI failure or no
  internet never blocks or delays the alert.
- **Notifications by Telegram bot** (tested and working). Contacts subscribe once with
  `t.me/<bot>?start=<code>` from the Settings view. WhatsApp/SMS automation (Twilio,
  WhatsApp Business) discarded: paid or needs approval.
- **Storage:** Upstash Redis (Vercel Marketplace, free) for alert JSON; Vercel Blob (free
  on Hobby) for audio clips. Vercel limits request bodies to 4.5 MB → short audio clips.
- **AI:** Groq — Whisper for transcription, an LLM for the short summary in Spanish.
- **CORS:** frontend is a separate Vercel project; `ALLOWED_ORIGIN` restricts it.
- **No Vercel CLI:** deploy through Vercel's GitHub import; local runs use the dev server.
