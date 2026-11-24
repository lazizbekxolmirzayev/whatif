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
- **Event library** with search, era/region filters and sorting
- **Event pages**: verified history ("Historical record") is visually separated from fictional scenarios ("Fictional possibility")
- **Branch timeline** (SVG) showing the verified line and diverging fictional branches
- **Create Your Own History**: pick an event, change its decision point, add an optional custom character, write consequences, save
- **Accounts and saved progress**: local to the browser (see limitations)
- **Premium gating** for curated scenarios and the saved-timeline limit

## Honest limitations (not faked)
- **No backend.** Accounts, progress and saved timelines live in `localStorage`. They do not sync across devices. Password hashing here is not a substitute for server-side auth.
- **No payments.** The Subscribe button is disabled; nothing can unlock Premium in production. A dev-only toggle exists under `NODE_ENV !== 'production'` for testing gating.
- **No AI generation.** Scenarios are hand-written and clearly labelled fictional. AI co-writing and cinematic video are shown as "not available yet".
- **10 events** are included; the long-term target is 1000+. Add events in `src/data/events.ts` (`npm test` checks structure).

## Content rules
`summary`, `verifiedFacts`, `pivot.actual` and `factors` must describe documented history; where historians disagree, say so. Everything in `scenarios` is speculation. Do not invent quotations or sources.

## Layout
```
src/app/          routes (/, /events, /events/[id], /create, /timelines, /premium, /account)
src/components/   Globe, WorldMap, BranchTimeline, EventView, CreateHistory, ...
src/data/         events.ts
src/lib/          geo.ts (map projection, globe texture), format.ts
src/store/        auth.ts, progress.ts, createStore.ts (localStorage-backed)
src/types.ts      shared TypeScript contracts
```
