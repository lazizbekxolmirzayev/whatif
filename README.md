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

## Playable scenario: `/play/ankara-1402`
A complete vertical slice of the game loop: briefing → explore a 3D globe (orbit/zoom, click locations and regions) → pick a decision → a cinematic plays (camera flies to the site, fades into a real-time 3D reconstruction of armies, walls and guns, then returns to the globe while regions change colour) → consequence panel (immediate and long-term effects, state changes, historical context, further reading) → next decision. Three to four decisions per run, 11 outcomes, one requirement-gated choice.
- **Engine** (`src/game/engine.ts`): pure and deterministic. A run is just the list of choice ids; state = `replay(scenario, ids)`. Supports flags, stats, requirements and branching rules. Runs are saved in `localStorage` and can be rewound from the timeline or reset.
- **Cinematics** (`src/game/choreography.ts`, `terrain.ts`, `components/game/Diorama.tsx`): every frame is `sceneFrame(spec, t)` from a small declarative spec (battle / siege / parley templates, seeded terrain). Playback has pause, seek, 0.5×/1×/2× and skip.
- **Video**: `components/game/MediaPlayer.tsx` plays real video files (play/pause, seek, fullscreen, WebVTT captions, scene description, loading and error states, fallback to the 3D cinematic). **No video provider is configured and no outcome has a video**, so the game always plays the real-time 3D cinematic. Integration contract: `src/game/media.ts` (`VideoProvider`, attach a `MediaRef` to `Outcome.media`). Dev-only test page: `/dev/media?src=<url>&vtt=<url>` (404 in production).
- Every choice and outcome is labelled **Documented history** or **Alternate history · fiction**. Globe regions are schematic, not historical borders. Sources are listed as further reading only; no quotations are invented.
- Add scenarios in `src/game/scenarios/` and register them in `index.ts`; `npm test` checks that every path terminates, outcomes are complete and the choreography stays in bounds.

## Backend notes
- Database: Node's built-in `node:sqlite` (**Node >= 22.13**, flagged experimental by Node). File: `$WHATIF_DB_PATH` or `./data/whatif.db` (git-ignored). It needs a **persistent disk** (VPS / Docker volume); it will not persist on ephemeral serverless filesystems. For those, swap `src/server/db.ts` for Postgres.
- Session cookie is `Secure` in production, so production must be served over **HTTPS**.
- Rate limiting is in-memory per process. Behind a reverse proxy, make sure it sets `X-Forwarded-For`.
- No secrets or environment variables are required to run.
- API: `POST /api/auth/{signup,login,logout}`, `GET /api/auth/me`, `GET|POST /api/progress`, `POST /api/branches`, `DELETE /api/branches/:id`. `POST /api/dev/plan` exists only when `NODE_ENV !== 'production'`.

## Honest limitations (not faked)
- **No payments.** The Subscribe button is disabled; nothing can unlock Premium in production. The dev-only plan switch exists to test gating.
- **Premium content is not yet protected server-side.** Locked scenarios are hidden in the UI, but their text is still part of the shipped data bundle. Real protection needs the premium scenario text moved behind an API that checks the plan.
- **No AI generation.** Scenarios are hand-written and clearly labelled fictional. AI co-writing and AI video are not available; the game's cinematics are real-time 3D, never presented as video.
- **No email verification or password reset yet.**
- **20 events** are included; the long-term target is 1000+. Add events in `src/data/` (`npm test` checks structure; extra batch in `src/data/events-extra.ts`).

## Content rules
`summary`, `verifiedFacts`, `pivot.actual` and `factors` must describe documented history; where historians disagree, say so. Everything in `scenarios` is speculation. Do not invent quotations or sources.

## Layout
```
src/app/          routes (/, /play, /play/[id], /events, /events/[id], /create, /timelines, /premium, /account)
src/components/   Globe, WorldMap, BranchTimeline, EventView, CreateHistory, ...
src/data/         events.ts
src/lib/          geo.ts (map projection, globe texture), format.ts
src/store/        auth.ts, progress.ts (client state backed by the API), createStore.ts
src/server/       db.ts (SQLite), auth.ts (scrypt, sessions), http.ts (validation helpers, rate limit)
src/app/api/      route handlers
src/game/         game engine, scenario data, choreography, terrain, video-provider contract
src/components/game/  World3D, Diorama, GameClient (HUD/panels), MediaPlayer
tests/            engine.test.ts
src/types.ts      shared TypeScript contracts
```
