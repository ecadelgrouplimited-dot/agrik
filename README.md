# AGRIK

Digital extension intelligence, advisory, market access, and farm operations for farmers.

AGRIK gives farmers, buyers/offtakers, service providers, and admins a shared
view into advisory chat, market listings, weather, subscriptions, and farm
records, backed by a Node.js/PostgreSQL API.

## Project layout

```
web/     React + TypeScript + Vite frontend (PWA)
api/     Node.js + TypeScript + Express + Prisma/PostgreSQL backend
deploy/  systemd unit, nginx config, and deployment runbook for the VPS
```

## Getting started

Frontend:

```bash
cd web
npm install
cp .env.example .env   # point VITE_API_BASE_URL at your backend
npm run dev
```

Backend (needs a local PostgreSQL instance):

```bash
cd api
npm install
cp .env.example .env   # fill in DATABASE_URL, JWT secrets, SMTP, AI keys
npx prisma migrate dev
npx tsx prisma/seed.ts # seeds Uganda districts (+ an admin if SEED_ADMIN_* set)
npm run dev
```

## Scripts

`web/`: `npm run dev` · `npm run build` (type-check + Vite build to `web/dist`) · `npm run preview` · `npm run lint`

`api/`: `npm run dev` (tsx watch) · `npm run build` (tsc to `api/dist`) · `npm start` · `npm run prisma:migrate` · `npm run seed`

## Environment variables

See `web/.env.example` and `api/.env.example` for the full list. Notable ones:

- `VITE_API_BASE_URL` — frontend's backend URL (baked in at Vite build time)
- `DATABASE_URL` — Postgres connection string for the API
- `JWT_SECRET` / `ADMIN_JWT_SECRET` — separate signing secrets for user vs admin sessions
- `SMTP_*` / `MAIL_FROM` — Hostinger SMTP for verification, password-reset, and admin OTP emails
- `DEEPSEEK_API_KEY` — chat (`deepseek-v4-pro`) and vision (`deepseek-v4-flash-vision-exp`, a separate model)
- `OPENAI_API_KEY` — audio transcription (Whisper) and text-to-speech

## Deployment

See [`deploy/DEPLOY.md`](deploy/DEPLOY.md) for the full VPS runbook (database,
systemd unit, nginx config, certbot). In short: the frontend builds to a
static `web/dist` served directly by nginx; the API runs as a systemd service
bound to `127.0.0.1:8000`, reverse-proxied by nginx at `api.agrik.co`.
