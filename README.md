# AGRIK

Digital extension intelligence, advisory, market access, and farm operations for farmers.

AGRIK is a React + Vite progressive web app that gives farmers, buyers/offtakers,
service providers, and admins a shared view into advisory chat, market listings,
weather, subscriptions, and farm records. It talks to a separate backend API over
HTTP (see `VITE_API_BASE_URL`).

## Project layout

```
web/    React + TypeScript + Vite frontend (the only app in this repo today)
```

## Getting started

```bash
cd web
npm install
cp .env.example .env   # point VITE_API_BASE_URL at your backend
npm run dev
```

## Scripts (run from `web/`)

| Command         | Purpose                                   |
| --------------- | ------------------------------------------ |
| `npm run dev`   | Start the Vite dev server                  |
| `npm run build` | Type-check (`tsc -b`) and build production assets to `web/dist` |
| `npm run preview` | Serve the production build locally       |
| `npm run lint`  | Run ESLint over `web/src`                  |

## Environment variables

Set these in `web/.env` (see `web/.env.example`):

- `VITE_API_BASE_URL` — base URL of the backend API (default `http://localhost:8000`)
- `VITE_API_TIMEOUT_MS` — request timeout in ms (default `10000`)
- `VITE_CHAT_TIMEOUT_MS` — timeout for chat/vision endpoints in ms (default `90000`)

## Deployment

`npm run build` produces a static `web/dist` directory that can be served by any
static file host (e.g. Nginx) on the VPS, with `VITE_API_BASE_URL` set at build
time to the deployed backend's URL. A service worker (`web/public/sw.js`) is
registered in production builds for offline/PWA support.
