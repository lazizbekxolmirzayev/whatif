# WHATIF

Premium, cinematic, interactive alternate-history platform. Explore real historical turning points on a 3D world, read what actually happened, then branch into fictional "what if" timelines, or write your own.

## Stack
Next.js 14 (App Router) · React 18 · TypeScript (strict) · Tailwind CSS · Three.js / React Three Fiber · `world-atlas` + `topojson-client` (offline map data). Grand Strategy adds React Router, Zustand, D3 (geo/zoom), Framer Motion, lucide-react, pako and the optional Supabase client.

## Run
```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
npm run typecheck
npm test           # event data, 3D-game engine + branching tests, Grand Strategy (Vitest)
```

## What works today
- **3D globe + 2D map** of historical events (falls back to the 2D map if WebGL is unavailable)
- **Event library** (20 events) with search, era/region filters and sorting
- **Event pages**: verified history ("Historical record") is visually separated from fictional scenarios ("Fictional possibility")
- **Branch timeline** (SVG) showing the verified line and diverging fictional branches
- **Create Your Own History**: pick an event, change its decision point, add an optional custom character, write consequences, save
- **Two game modes**: the 3D story game (`/play`) and the Grand Strategy simulation (`/strategy`, UZ/EN/RU)
- **Real backend**: server-side accounts (scrypt password hashing, httpOnly session cookie), SQLite database, saved timelines and progress via `/api/*`. The free-plan limit (3 timelines) is enforced on the server.

## Playable scenario: `/play/ankara-1402`
A complete vertical slice of the game loop: briefing → explore a 3D globe (orbit/zoom, click locations and regions) → pick a decision → a cinematic plays (camera flies to the site, fades into a real-time 3D reconstruction of armies, walls and guns, then returns to the globe while regions change colour) → consequence panel (immediate and long-term effects, world changes, historical context, further reading) → next decision. Five decision points, 13 outcomes, 16 possible paths, 8 endings, one requirement-gated choice.
- **Engine** (`src/game/engine.ts`): pure and deterministic. A run is just the list of choice ids; state = `replay(scenario, ids)`. Supports flags, stats, requirements and branching rules. Runs are saved in `localStorage` and can be rewound from the timeline or reset.
- **Cinematics** (`src/game/choreography.ts`, `terrain.ts`, `components/game/Diorama.tsx`): every frame is `sceneFrame(spec, t)` from a small declarative spec (battle / siege / parley templates, seeded terrain). Playback has pause, seek, 0.5×/1×/2× and skip.
- **Video**: `components/game/MediaPlayer.tsx` plays real video files (play/pause, seek, fullscreen, WebVTT captions, scene description, loading and error states, fallback to the 3D cinematic). **No video provider is configured and no outcome has a video**, so the game always plays the real-time 3D cinematic. Integration contract: `src/game/media.ts` (`VideoProvider`, attach a `MediaRef` to `Outcome.media`). Dev-only test page: `/dev/media?src=<url>&vtt=<url>` (404 in production).
- Every choice and outcome is labelled **Documented history** or **Alternate history · fiction**. Globe regions are schematic, not historical borders. Sources are listed as further reading only; no quotations are invented.
- **Branching history** (`src/game/branches.ts`): you always start on the *original* timeline, which is derived from the scenario data (the single documented choice at each node), frozen, and never stored. Taking a documented choice moves along it; taking any other choice opens a new branch. Revisiting a past decision (click a diamond on the timeline) and choosing differently forks again; the earlier branch is untouched, and an existing identical path is reused instead of duplicated. Branches are saved in `localStorage` as decision lists with a state fingerprint; on load each one is replayed and repaired if the data changed. The single run saved by the previous version is migrated.
- **World state** (`WorldVar` in `src/game/types.ts`): countries, regions, politics (seat of power, succession), economy (trade through the straits), technology (siege artillery), population, historical figures and relations. Values are qualitative, authored states; every change comes from an explicit effect, including conditional effects and the passage of time when a later decision is reached (`DecisionNode.enter`). Numeric indices are labelled as schematic.
- **Timeline** (`chronicle()`): dated entries for documented background and every outcome; original and branch are drawn on one axis with the fork point, decision markers and the branch's recorded future. A documented choice taken after a branch diverged is labelled "alternate timeline · mirrors reality".
- **Map consequences**: territory colours animate to the shown state, changed regions are outlined, affected locations pulse with their status, the capital crown moves, a beacon marks the current decision.
- **Compare** (`src/game/compare.ts`): any two timelines (default: original vs current) aligned by event key: same / different date / different outcome / only in one; world-state and map differences (globe toggle + two flat maps); the divergence point with both cinematics.
- **Branch map and endings**: every possible path (16) as a tree with explored and unexplored branches; 8 data-defined endings with a discovery counter. "Replay this timeline" re-plays every recorded decision with its cinematic and reproduces the same fingerprint.
- Add scenarios in `src/game/scenarios/` and register them in `index.ts`; `npm test` checks that every path terminates and reaches an ending, every world value is defined, the original stays historical and unchanged, branches stay independent and reproducible, and the choreography stays in bounds.

## Grand Strategy: `/strategy` (integrated from PAXAILOVASI)
A browser grand-strategy game, originally the separate repository `lazizbekxolmirzayev/PAXAILOVASI`, now part of the site. Rewrite pivotal moments of history or forge your own empire on historical borders, then let an interconnected simulation (economy, food, population, health, technology, stability, diplomacy, war, events and AI states) play out the consequences. Interface in **Uzbek, English and Russian**.

- Route: every `/strategy/*` URL renders `src/app/strategy/[[...slug]]/page.tsx`, which mounts the game client-side (`src/components/StrategyEntry.tsx` → `src/strategy/StrategyApp.tsx`). The game keeps its own router (React Router, `basename="/strategy"`), so deep links, reloads and the back button work. Links connect it with the rest of the site (site nav, home page, `/play`, "← WHATIF" in the game header).
- Styles: the game has its own Tailwind theme (`tailwind.strategy.config.ts`, imported by `src/strategy/strategy.css` via `@config`). Its utilities are scoped to `#strategy-root`, so its palette never changes WHATIF pages, and WHATIF's `tailwind.config.ts` does not scan `src/strategy`. The game's component classes (`.panel`, `.btn-gold`, `.input`, `.label`, `.chip`, `.map-*`, …) stay global once the game has loaded; do not reuse those class names elsewhere in the site.
- Everything works **offline** without a backend: local saves (IndexedDB, gzip-compressed), guest profile, hot-seat multiplayer and the built-in rule-based AI Historian. Game data lives in the browser (`whatif-db`, `whatif-profile`, `whatif-settings`); it is separate from WHATIF accounts.

| Area | Where |
|---|---|
| Simulation engine (pure TS, deterministic, no DOM) | `src/strategy/engine/*` |
| Monthly systems: economy, food, population, health, tech, stability, military, infrastructure | `src/strategy/engine/systems.ts` |
| War, battles, occupation, peace | `src/strategy/engine/military.ts` |
| Diplomacy with transparent AI acceptance factors | `src/strategy/engine/diplomacy.ts` |
| AI decision engine (every decision logged with its reason) | `src/strategy/engine/ai.ts` |
| Event engine (triggers, probabilities, choices, effects; custom events) | `src/strategy/engine/events.ts` |
| Historical scenarios & divergence consequences (8) | `src/strategy/data/scenarios.ts`, `src/strategy/engine/scenario.ts` |
| Player commands (single validation path for client & server) | `src/strategy/engine/commands.ts` |
| AI Historian (rule-based) + 12-month projection | `src/strategy/engine/historian.ts` |
| UI pages | `src/strategy/pages/*`, `src/strategy/pages/game/*` |
| Interactive map (D3 + TopoJSON) | `src/strategy/components/map/WorldMap.tsx` |
| Map data (served statically) | `public/strategy-data/maps/*` |
| Supabase schema, RLS, functions (optional) | `supabase/*` |

Time controls: Pause / 1× / 2× / 5× / 10×, +1 month / +1 year / +10 years. Keyboard: Space, 1–4.

**Data & honesty.** Borders: [historical-basemaps](https://github.com/aourednik/historical-basemaps) by André Ourednik (**GPL-3.0**) for 20 dates from 500 BC to 2000; known coarse labels are corrected in `src/strategy/data/polities.ts` and every correction is shown in the World Explorer. Provinces: Natural Earth admin-1 regions (public domain), modern shapes used as an approximation of historical provinces. Population: rounded consensus estimates (McEvedy & Jones, Maddison, UN/HYDE), labelled as approximations. Economic, military and technology numbers are game-model values, not measurements. Documented history and simulated events are labelled separately. Rebuild map data: `scripts/strategy/README.md`.

**Supabase (optional: accounts, cloud saves, community scenarios, online multiplayer, LLM historian).**
1. Copy `.env.example` → `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the public anon key only).
2. `supabase link --project-ref <ref>`, `supabase db push`, then `psql "$DATABASE_URL" -f supabase/seed.sql`.
3. Upload every file in `public/strategy-data/maps/` to the public bucket `game-data`.
4. `npm run strategy:sync-engine` (bundles the engine for the Edge Function), `supabase functions deploy multiplayer-turn`, `supabase functions deploy ai-historian`, `supabase secrets set ANTHROPIC_API_KEY=...` (server-side only, never in a `NEXT_PUBLIC_` variable).
5. Optional: `NEXT_PUBLIC_ENABLE_AI_HISTORIAN=true` to offer the language-model historian (the built-in one remains the labelled fallback).

Security: Row Level Security on every table; world state, turn numbers and country assignments are written only by the Edge Function; rate limiting via `check_rate_limit`; the AI key lives only in function secrets. No concurrent-user capacity is claimed without load testing.

Tests: `npm run test:strategy` (Vitest; also part of `npm test`) covers world creation from datasets, deterministic ticks, save → load → continue with identical hashes, all 8 scenarios, command validation, AI historian answers, consequence projection, scenario validation and share codes.

## Backend notes
- Database: Node's built-in `node:sqlite` (**Node >= 22.13**, flagged experimental by Node). File: `$WHATIF_DB_PATH` or `./data/whatif.db` (git-ignored). It needs a **persistent disk** (VPS / Docker volume); it will not persist on ephemeral serverless filesystems. For those, swap `src/server/db.ts` for Postgres.
- Session cookie is `Secure` in production, so production must be served over **HTTPS**.
- Rate limiting is in-memory per process. Behind a reverse proxy, make sure it sets `X-Forwarded-For`.
- No secrets or environment variables are required to run. Optional variables are listed in `.env.example`.
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
src/app/          routes (/, /play, /play/[id], /strategy/[[...slug]], /events, /events/[id], /create, /timelines, /premium, /account)
src/components/   Globe, WorldMap, BranchTimeline, EventView, CreateHistory, ...
src/data/         events.ts
src/lib/          geo.ts (map projection, globe texture), format.ts
src/store/        auth.ts, progress.ts (client state backed by the API), createStore.ts
src/server/       db.ts (SQLite), auth.ts (scrypt, sessions), http.ts (validation helpers, rate limit)
src/app/api/      route handlers
src/game/         engine, branches, compare, scenario data, choreography, terrain, video-provider contract
src/components/game/  World3D, Diorama, GameClient, MediaPlayer, hud/ (WorldPanel, Chronicle, DecisionPanel, ConsequencePanel, EndingCard, BranchDrawer, BranchMap, ComparePanel, MiniMap)
tests/            engine.test.ts, branches.test.ts
src/strategy/     Grand Strategy game (engine, data, pages, services, i18n UZ/EN/RU), own Tailwind theme
public/strategy-data/  historical map data for the Grand Strategy game
supabase/         optional backend of the Grand Strategy game (schema, seed, Edge Functions)
src/types.ts      shared TypeScript contracts
```
