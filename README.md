# WHATIF

Premium, cinematic, interactive alternate-history platform. Explore real historical turning points on a 3D world, read what actually happened, then branch into fictional "what if" timelines, or write your own.

## Stack
Next.js 14 (App Router) · React 18 · TypeScript (strict) · Tailwind CSS · Three.js / React Three Fiber · `world-atlas` + `topojson-client` (offline map data)

## Run
```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
npm run typecheck
npm test           # validates src/data/events.ts
```

## What works today
- **3D globe + 2D map** of historical events (falls back to the 2D map if WebGL is unavailable)
- **Event library** (20 events) with search, era/region filters and sorting
- **Event pages**: verified history ("Historical record") is visually separated from fictional scenarios ("Fictional possibility")
- **Branch timeline** (SVG) showing the verified line and diverging fictional branches
- **Create Your Own History**: pick an event, change its decision point, add an optional custom character, write consequences, save
- **Real backend**: server-side accounts (scrypt password hashing, httpOnly session cookie), SQLite database, saved timelines and progress via `/api/*`. The free-plan limit (3 timelines) is enforced on the server.

## Backend notes
- Database: Node's built-in `node:sqlite` (**Node >= 22.13**, flagged experimental by Node). File: `$WHATIF_DB_PATH` or `./data/whatif.db` (git-ignored). It needs a **persistent disk** (VPS / Docker volume); it will not persist on ephemeral serverless filesystems. For those, swap `src/server/db.ts` for Postgres.
- Session cookie is `Secure` in production, so production must be served over **HTTPS**.
- Rate limiting is in-memory per process. Behind a reverse proxy, make sure it sets `X-Forwarded-For`.
- No secrets or environment variables are required to run.
- API: `POST /api/auth/{signup,login,logout}`, `GET /api/auth/me`, `GET|POST /api/progress`, `POST /api/branches`, `DELETE /api/branches/:id`. `POST /api/dev/plan` exists only when `NODE_ENV !== 'production'`.

## Honest limitations (not faked)
- **No payments.** The Subscribe button is disabled; nothing can unlock Premium in production. The dev-only plan switch exists to test gating.
- **Premium content is not yet protected server-side.** Locked scenarios are hidden in the UI, but their text is still part of the shipped data bundle. Real protection needs the premium scenario text moved behind an API that checks the plan.
- **No AI generation.** Scenarios are hand-written and clearly labelled fictional. AI co-writing and cinematic video are shown as "not available yet".
- **No email verification or password reset yet.**
- **20 events** are included; the long-term target is 1000+. Add events in `src/data/` (`npm test` checks structure; extra batch in `src/data/events-extra.ts`).

## Content rules
`summary`, `verifiedFacts`, `pivot.actual` and `factors` must describe documented history; where historians disagree, say so. Everything in `scenarios` is speculation. Do not invent quotations or sources.

## Layout
```
src/app/          routes (/, /events, /events/[id], /create, /timelines, /premium, /account)
src/components/   Globe, WorldMap, BranchTimeline, EventView, CreateHistory, ...
src/data/         events.ts
src/lib/          geo.ts (map projection, globe texture), format.ts
src/store/        auth.ts, progress.ts (client state backed by the API), createStore.ts
src/server/       db.ts (SQLite), auth.ts (scrypt, sessions), http.ts (validation helpers, rate limit)
src/app/api/      route handlers
src/types.ts      shared TypeScript contracts
```
