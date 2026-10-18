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
  with `npm run typecheck` + `npm run lint` + `npm test` clean and several small commits. Never push
  unless asked.
- Commits authored as MarioZaMu only, no `Co-Authored-By` trailers.
- Secrets (Groq key, Telegram token) only in env variables, never in code or frontend.
- Keep this file updated with every decision.

## Commands

```bash
npm install
npm run dev     # local server (scripts/dev-server.ts) at http://localhost:3000, loads .env
npm run typecheck  # tsc only. Deliberately NOT named `build`: with a build script Vercel
                   # treats the repo as a static site and fails looking for public/
npm test           # Vitest unit tests
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

Write endpoints need `Authorization: Bearer <ALERT_API_TOKEN>`. Ids are UUIDs (validated).

| Method | Path | Body / query | Purpose |
| ------ | ---- | ------------ | ------- |
| GET  | `/api/health` | — | Health check |
| POST | `/api/alerts` | `{ alertId, startedAt?, captureKind?, location? }` | Creates the alert (idempotent) and sends the Telegram alert at once; storage failure never blocks the message |
| POST | `/api/location` | `{ alertId, location }` | Adds a position; the first one also goes as a Telegram map pin |
| POST | `/api/audio?alertId&index&durationMs` | raw audio (`audio/mp4`, `audio/webm`, `audio/wav`) | Stores the chunk in private Blob, then (waitUntil) Whisper → summary → final message |
| GET  | `/api/audio?alertId&index` | — | Streams a chunk (contact view) |
| POST | `/api/stop` | `{ alertId, reason?, totalChunks }` | Closes the alert; the final summary is sent once every announced chunk is processed |
| GET  | `/api/alert?id` | — | Public contact view data: status, positions, chunks with transcripts, summary |

Code: `lib/alertModel.ts` (types, validation, Spanish Telegram text, unit tested),
`lib/alertStore.ts` (Redis: alert hash `alert:{id}`, `:locations` list, `:chunks` hash,
`:flags` one-time claims; 30-day TTL), `lib/telegram.ts`, `lib/ai.ts` (Groq
`whisper-large-v3-turbo`, summary `openai/gpt-oss-120b` with a strict prompt that ignores
Whisper's silence hallucinations like "suscríbete al canal"), `lib/alertProcessing.ts`.

Next (phase 9+): contact view in the frontend, per-user contacts via the Telegram
`/start` flow (phase 7), cancel / false alarm (phase 10).

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
- **Deploy:** Vercel GitHub integration (push to `main` = production). The Vercel CLI is
  linked (`.vercel/`, git-ignored) and used for env vars and logs
  (`npx vercel inspect <url> --logs`). If npx fails with a `luxon` module error, delete
  the corrupted `%LOCALAPPDATA%\npm-cache\_npx\<hash>` folder.
- **Env files:** `npx vercel env pull .env.local` brings Redis, Blob store id, URLs and a
  12 h `VERCEL_OIDC_TOKEN`. Secrets are "Sensitive" in Vercel and cannot be pulled, so they
  live in `.env` (loaded after `.env.local`): `TELEGRAM_BOT_TOKEN`, `DEFAULT_CHAT_IDS`,
  `GROQ_API_KEY`, `ALERT_API_TOKEN`, `ALLOWED_ORIGIN=http://localhost:5173`.
- **Blob uses OIDC** (no `BLOB_READ_WRITE_TOKEN`): `BLOB_STORE_ID` + the function's OIDC
  token. The store's connection does not allow the Development environment and the CLI
  only issues development tokens, so **audio uploads fail locally**; test audio against
  production (or a deployment). Everything else works with `npm run dev`.
- **Contacts:** `DEFAULT_CHAT_IDS` (comma separated) until phase 7.
- **Token in the app:** `ALERT_API_TOKEN` ships inside the frontend bundle/APK, so it
  only stops casual abuse. Per-device keys are a later improvement.
