'use client'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ApplyResult, CinematicSpec, Scenario, WorldState } from '@/game/types'
import { applyChoice, availableChoices, diffState, getNode, isEnded, maxDepth, replay, summarize } from '@/game/engine'
import { FACTION_COLOR, FACTION_NAME } from '@/game/factions'
import { TIMING, sceneFrame, segments, totalDuration } from '@/game/choreography'
import { videoProviderStatus } from '@/game/media'
import MediaPlayer from './MediaPlayer'
import type { CinePhase, CinematicRun, Clock } from './World3D'

const World3D = dynamic(() => import('./World3D'), { ssr: false, loading: () => <div className="absolute inset-0 grid place-items-center text-parchment/60">Preparing the world…</div> })

type Mode = 'briefing' | 'explore' | 'cinematic' | 'consequence' | 'ending'
const STAT_LABEL = { ottomanPower: 'Ottoman power', timuridReach: 'Timurid reach', byzantineSecurity: 'Byzantine security', stability: 'Stability' } as const
const KIND_BADGE = {
  historical: 'border-emerald-400/40 text-emerald-300',
  fictional: 'border-fuchsia-400/40 text-fuchsia-300',
} as const
const kindLabel = (k: 'historical' | 'fictional') => (k === 'historical' ? 'Documented history' : 'Alternate history · fiction')
const storeKey = (id: string) => `whatif.run.${id}`

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`pointer-events-auto rounded-lg border border-gold-500/20 bg-midnight-950/85 p-4 shadow-2xl backdrop-blur-md ${className}`}>{children}</div>
}
function Badge({ kind }: { kind: 'historical' | 'fictional' }) {
  return <span className={`rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-widest ${KIND_BADGE[kind]}`}>{kindLabel(kind)}</span>
}

export default function GameClient({ scenario: sc }: { scenario: Scenario }) {
  const [choices, setChoices] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)
  const [mode, setMode] = useState<Mode>('briefing')
  const [pending, setPending] = useState<ApplyResult | null>(null)
  const [last, setLast] = useState<{ result: ApplyResult; before: WorldState } | null>(null)
  const [info, setInfo] = useState<{ type: 'site' | 'territory'; id: string } | null>(null)
  const [focus, setFocus] = useState<{ site: string; token: number }>({ site: sc.nodes[sc.start].siteId, token: 0 })
  const [phase, setPhase] = useState<CinePhase | null>(null)
  const [prog, setProg] = useState(0)
  const [caption, setCaption] = useState<string | null>(null)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [failure, setFailure] = useState('')
  const [useVideo, setUseVideo] = useState(true)
  const clock = useRef<Clock>({ t: 0, playing: false, speed: 1 })
  const fadeRef = useRef<HTMLDivElement | null>(null)
  const pendingRef = useRef<ApplyResult | null>(null)
  pendingRef.current = pending

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storeKey(sc.id))
      const arr = raw ? (JSON.parse(raw) as unknown) : []
      if (Array.isArray(arr) && arr.every((x) => typeof x === 'string')) {
        replay(sc, arr as string[])
        setChoices(arr as string[])
      }
    } catch {
      setChoices([])
    }
    setLoaded(true)
  }, [sc])
  const persist = useCallback(
    (ids: string[]) => {
      setChoices(ids)
      try {
        window.localStorage.setItem(storeKey(sc.id), JSON.stringify(ids))
      } catch {
        /* storage unavailable; run stays in memory */
      }
    },
    [sc.id],
  )

  const state = useMemo(() => replay(sc, choices).state, [sc, choices])
  const node = getNode(sc, state)
  const options = useMemo(() => (node ? availableChoices(sc, state) : []), [sc, state, node])
  const depth = useMemo(() => maxDepth(sc), [sc])
  const sum = summarize(state)

  const run = useMemo<CinematicRun | null>(() => (pending && node ? { spec: pending.outcome.cinematic, siteId: node.siteId, after: pending.state.control } : null), [pending, node])
  const spec: CinematicSpec | null = run?.spec ?? null

  const goExplore = useCallback(
    (s: WorldState) => {
      const n = getNode(sc, s)
      setMode(isEnded(s) || !n ? 'ending' : 'explore')
      if (n) setFocus((f) => ({ site: n.siteId, token: f.token + 1 }))
      setInfo(null)
    },
    [sc],
  )

  const choose = (id: string) => {
    if (mode !== 'explore') return
    try {
      const r = applyChoice(sc, state, id)
      setPending(r)
      setUseVideo(true)
      setFailure('')
      clock.current = { t: 0, playing: true, speed }
      setPlaying(true)
      setProg(0)
      setCaption(null)
      setMode('cinematic')
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'That decision is not available.')
    }
  }

  const finish = useCallback(() => {
    const r = pendingRef.current
    if (!r) return
    setLast({ result: r, before: state })
    persist([...choices, r.choice.id])
    setPending(null)
    setPhase(null)
    setMode('consequence')
  }, [choices, persist, state])
  const finishRef = useRef(finish)
  finishRef.current = finish

  const onEnd = useCallback(() => finishRef.current(), [])
  const lastProg = useRef(-1)
  const onPhase = useCallback((p: CinePhase, t: number) => {
    setPhase((x) => (x === p ? x : p))
    if (Math.abs(t - lastProg.current) > 0.08) {
      lastProg.current = t
      setProg(t)
      const s = pendingRef.current?.outcome.cinematic
      if (s) {
        const seg = segments(s)
        const lt = Math.min(s.duration, Math.max(0, t - seg.sceneStart))
        setCaption(t >= seg.sceneStart && t <= seg.sceneEnd ? sceneFrame(s, lt).caption : null)
      }
    }
  }, [])

  const setT = (t: number) => {
    clock.current.t = t
    lastProg.current = -1
  }
  const togglePlay = () => {
    clock.current.playing = !clock.current.playing
    setPlaying(clock.current.playing)
  }
  const changeSpeed = (s: number) => {
    clock.current.speed = s
    setSpeed(s)
  }
  const skip = () => {
    if (spec) setT(totalDuration(spec) - 0.001)
  }
  const replayCine = () => {
    if (!last || !node) return
    // replay the previous outcome from the pre-decision world
    const r = last.result
    persist(choices.slice(0, -1))
    setPending(r)
    setUseVideo(true)
    clock.current = { t: 0, playing: true, speed }
    setPlaying(true)
    setCaption(null)
    setMode('cinematic')
  }
  const rewind = (i: number) => {
    if (mode === 'cinematic') return
    persist(choices.slice(0, i))
    setLast(null)
    goExplore(replay(sc, choices.slice(0, i)).state)
  }
  const reset = () => {
    if (mode === 'cinematic') {
      setPending(null)
      setPhase(null)
    }
    persist([])
    setLast(null)
    setMode('briefing')
    setInfo(null)
    setFocus((f) => ({ site: sc.nodes[sc.start].siteId, token: f.token + 1 }))
  }

  const diff = last ? diffState(last.before, last.result.state) : null
  const shownYear = useMemo(() => {
    if (mode === 'cinematic' && pending && spec) {
      const k = Math.min(1, Math.max(0, prog / totalDuration(spec)))
      return Math.round(state.year + (pending.outcome.endYear - state.year) * k)
    }
    return state.year
  }, [mode, pending, spec, prog, state.year])
  const stats = mode === 'cinematic' && pending && phase === 'result' ? pending.state.stats : state.stats
  const total = spec ? totalDuration(spec) : 1
  const media = pending?.outcome.media
  const showVideo = mode === 'cinematic' && !!media && useVideo
  const variants = node?.variants?.filter((v) => state.flags[v.flag]) ?? []
  const years = [sc.startYear, ...sc.anchors.map((a) => a.year)]
  const y0 = Math.min(...years)
  const y1 = Math.max(...years)
  const pos = (y: number) => `${((y - y0) / Math.max(1, y1 - y0)) * 100}%`

  const infoBody = (() => {
    if (!info) return null
    if (info.type === 'site') {
      const s = sc.sites.find((x) => x.id === info.id)
      return s ? { title: s.name, text: s.blurb, tag: 'Location' } : null
    }
    const t = sc.territories.find((x) => x.id === info.id)
    return t ? { title: t.name, text: `${t.note} Controlled by: ${FACTION_NAME[state.control[t.id] ?? t.initial]}.`, tag: 'Schematic region, not a historical border' } : null
  })()

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#05070d] text-parchment" data-testid="game-root" data-mode={mode} data-phase={phase ?? ''} data-decisions={choices.length} data-year={shownYear}>
      <div className="absolute inset-0">
        {loaded && (
          <World3D
            scenario={sc}
            control={state.control}
            focusSiteId={focus.site}
            focusToken={focus.token}
            cinematic={mode === 'cinematic' && !showVideo ? run : null}
            clock={clock}
            fadeRef={fadeRef}
            onSite={(id) => setInfo({ type: 'site', id })}
            onTerritory={(id) => setInfo({ type: 'territory', id })}
            onPhase={onPhase}
            onEnd={onEnd}
            onFail={setFailure}
          />
        )}
      </div>
      <div ref={fadeRef} className="pointer-events-none absolute inset-0 z-10 bg-black opacity-0" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-24 bg-gradient-to-b from-black/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-40 bg-gradient-to-t from-black/70 to-transparent" />

      {/* top HUD */}
      <header className="absolute inset-x-0 top-0 z-[45] flex items-start gap-4 p-4">
        <Link href="/" className="pointer-events-auto font-serif text-lg tracking-[0.2em] text-gold-400 hover:text-gold-300">
          WHATIF
        </Link>
        <div className="pointer-events-none hidden min-w-0 flex-1 sm:block">
          <p className="truncate font-serif text-lg text-parchment">{sc.title}</p>
          <p className="text-xs text-parchment/60" data-testid="progress">
            Decisions {choices.length} / up to {depth} · {sum.historical} documented · {sum.fictional} alternate
          </p>
        </div>
        <div className="pointer-events-none ml-auto text-right">
          <p className="font-serif text-3xl tabular-nums text-gold-300" data-testid="year">{shownYear}</p>
        </div>
        <button onClick={reset} className="pointer-events-auto rounded-md border border-white/15 bg-black/40 px-3 py-1.5 text-xs hover:border-gold-500/50" data-testid="reset">
          Reset
        </button>
      </header>

      {/* stats */}
      {mode !== 'briefing' && (
        <div className="absolute left-4 top-20 z-30 hidden w-52 space-y-2 md:block">
          <Panel className="space-y-2 !p-3">
            {(Object.keys(STAT_LABEL) as (keyof typeof STAT_LABEL)[]).map((k) => (
              <div key={k}>
                <div className="flex justify-between text-[11px] text-parchment/70">
                  <span>{STAT_LABEL[k]}</span>
                  <span className="tabular-nums" data-testid={`stat-${k}`}>{stats[k]}</span>
                </div>
                <div className="h-1 overflow-hidden rounded bg-white/10">
                  <div className="h-full bg-gold-500 transition-all duration-700" style={{ width: `${stats[k]}%` }} />
                </div>
              </div>
            ))}
          </Panel>
          <Panel className="!p-3">
            <p className="mb-1 text-[10px] uppercase tracking-widest text-parchment/50">Schematic regions (not borders)</p>
            {sc.territories.map((t) => (
              <p key={t.id} className="flex items-center gap-2 text-[11px] text-parchment/75">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: FACTION_COLOR[state.control[t.id] ?? t.initial] }} />
                {t.name}
              </p>
            ))}
          </Panel>
        </div>
      )}

      {/* info */}
      {infoBody && mode !== 'cinematic' && mode !== 'briefing' && (
        <div className="absolute left-4 top-[26rem] z-30 hidden w-64 md:block" data-testid="info-panel">
          <Panel className="!p-3">
            <p className="text-[10px] uppercase tracking-widest text-gold-400">{infoBody.tag}</p>
            <p className="font-serif text-lg">{infoBody.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-parchment/75">{infoBody.text}</p>
            <button className="mt-2 text-[11px] text-parchment/50 hover:text-parchment" onClick={() => setInfo(null)}>Close</button>
          </Panel>
        </div>
      )}

      {/* briefing */}
      {mode === 'briefing' && loaded && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/55 p-4">
          <Panel className="max-w-xl !p-8 text-center" >
            <p className="text-xs uppercase tracking-[0.3em] text-gold-400">Scenario · {sc.startYear}</p>
            <h1 className="mt-2 font-serif text-3xl text-parchment">{sc.title}</h1>
            <p className="mt-1 italic text-parchment/70">{sc.tagline}</p>
            <p className="mt-4 text-sm leading-relaxed text-parchment/80">{sc.premise}</p>
            <p className="mt-3 text-xs text-parchment/50">Documented history and invented alternate history are labelled separately at every step. Regions on the globe are schematic.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {choices.length > 0 && (
                <button data-testid="continue" onClick={() => goExplore(state)} className="rounded-md bg-gold-500 px-5 py-2.5 font-medium text-midnight-950 hover:bg-gold-400">
                  Continue ({choices.length} decision{choices.length > 1 ? 's' : ''})
                </button>
              )}
              <button
                data-testid="begin"
                onClick={() => {
                  if (choices.length > 0) persist([])
                  goExplore(replay(sc, []).state)
                }}
                className={`rounded-md px-5 py-2.5 font-medium ${choices.length ? 'border border-white/20 hover:border-gold-500/50' : 'bg-gold-500 text-midnight-950 hover:bg-gold-400'}`}
              >
                {choices.length ? 'Start over' : 'Enter the world'}
              </button>
            </div>
            <p className="mt-4 text-[11px] text-parchment/40">{videoProviderStatus().message}</p>
          </Panel>
        </div>
      )}

      {/* decision panel */}
      {mode === 'explore' && node && (
        <div className="absolute bottom-24 right-4 z-30 w-[min(30rem,calc(100vw-2rem))]" data-testid="decision-panel">
          <Panel className="max-h-[62vh] overflow-y-auto">
            <p className="text-[10px] uppercase tracking-widest text-gold-400">{node.dateLabel}</p>
            <h2 className="font-serif text-2xl">{node.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-parchment/80">{node.situation}</p>
            {variants.map((v) => (
              <p key={v.flag} className="mt-2 border-l-2 border-fuchsia-400/50 pl-3 text-xs italic text-parchment/70">{v.text}</p>
            ))}
            <p className="mt-4 font-serif text-lg text-gold-200">{node.question}</p>
            <div className="mt-2 space-y-2">
              {options.map(({ choice, locked }) => (
                <button
                  key={choice.id}
                  data-testid={`choice-${choice.id}`}
                  disabled={locked}
                  onClick={() => choose(choice.id)}
                  className={`w-full rounded-md border p-3 text-left transition ${locked ? 'cursor-not-allowed border-white/5 bg-white/[0.02] opacity-50' : 'border-white/10 bg-white/[0.04] hover:border-gold-500/60 hover:bg-gold-500/10'}`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-medium">{choice.label}</span>
                    <Badge kind={choice.historical ? 'historical' : 'fictional'} />
                  </span>
                  <span className="mt-1 block text-xs text-parchment/65">{locked ? choice.lockedReason ?? 'Not available in this timeline.' : choice.summary}</span>
                </button>
              ))}
            </div>
            {failure && <p className="mt-3 text-xs text-red-300" role="alert">{failure}</p>}
          </Panel>
        </div>
      )}

      {/* cinematic overlays */}
      {mode === 'cinematic' && pending && (
        <>
          <div className="absolute inset-x-0 top-24 z-30 flex justify-center px-4">
            <div className="pointer-events-none max-w-xl text-center">
              <Badge kind={pending.outcome.kind} />
              <p className="mt-2 font-serif text-2xl text-parchment drop-shadow">{pending.outcome.title}</p>
              <p className="text-[11px] uppercase tracking-widest text-parchment/50" data-testid="cine-phase">
                {phase === 'fly' ? 'Travelling to the location' : phase === 'scene' ? 'Reconstruction (real-time 3D, schematic)' : 'Consequences'}
              </p>
            </div>
          </div>
          {phase === 'scene' && caption && (
            <div className="pointer-events-none absolute inset-x-0 bottom-36 z-30 flex justify-center px-4">
              <p className="max-w-2xl rounded bg-black/70 px-4 py-2 text-center text-sm text-parchment" data-testid="caption">{caption}</p>
            </div>
          )}
          {showVideo && media && (
            <div className="absolute inset-0 z-40 grid place-items-center bg-black/80 p-4">
              <div className="w-full max-w-3xl space-y-3">
                <MediaPlayer media={media} title={pending.outcome.title} fictional={pending.outcome.kind === 'fictional'} onEnded={finish} onFallback={() => setUseVideo(false)} />
                <button onClick={() => setUseVideo(false)} className="text-sm text-parchment/70 underline">Watch the real-time 3D cinematic instead</button>
              </div>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-20 z-30 flex justify-center px-4">
            <Panel className="flex w-full max-w-2xl items-center gap-3 !p-2.5" >
              <button onClick={togglePlay} data-testid="play-pause" className="w-20 rounded border border-white/15 py-1 text-sm hover:border-gold-500/50">{playing ? 'Pause' : 'Resume'}</button>
              <input
                aria-label="Cinematic position"
                data-testid="seek"
                type="range"
                min={0}
                max={total}
                step={0.05}
                value={Math.min(prog, total)}
                onChange={(e) => setT(Number(e.target.value))}
                className="h-1 flex-1 accent-[#d4b66c]"
              />
              {[0.5, 1, 2].map((s) => (
                <button key={s} onClick={() => changeSpeed(s)} className={`rounded border px-2 py-1 text-xs ${speed === s ? 'border-gold-500/60 text-gold-300' : 'border-white/15'}`}>{s}×</button>
              ))}
              <button onClick={skip} data-testid="skip" className="rounded border border-white/15 px-2 py-1 text-xs hover:border-gold-500/50">Skip</button>
            </Panel>
          </div>
        </>
      )}

      {/* consequence */}
      {mode === 'consequence' && last && (
        <div className="absolute bottom-24 right-4 z-30 w-[min(34rem,calc(100vw-2rem))]" data-testid="consequence-panel">
          <Panel className="max-h-[68vh] space-y-3 overflow-y-auto">
            <div className="flex items-center justify-between gap-2">
              <Badge kind={last.result.outcome.kind} />
              <span className="text-xs text-parchment/50">until {last.result.outcome.endYear}</span>
            </div>
            <h2 className="font-serif text-2xl">{last.result.outcome.title}</h2>
            <p className="text-sm italic text-parchment/75">{last.result.outcome.visual}</p>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gold-400">Immediate effects</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-parchment/85">{last.result.outcome.immediate.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gold-400">Long-term effects</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-parchment/85">{last.result.outcome.longTerm.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
            {diff && (diff.stats.length > 0 || diff.control.length > 0) && (
              <div className="rounded border border-white/10 p-2 text-xs text-parchment/75" data-testid="diff">
                {diff.stats.map((d) => (
                  <p key={d.id}>{STAT_LABEL[d.id]}: {d.from} → <b className={d.to > d.from ? 'text-emerald-300' : 'text-red-300'}>{d.to}</b></p>
                ))}
                {diff.control.map((d) => (
                  <p key={d.territory}>{sc.territories.find((t) => t.id === d.territory)?.name}: {FACTION_NAME[d.from]} → <b>{FACTION_NAME[d.to]}</b></p>
                ))}
              </div>
            )}
            <div className="rounded border border-white/10 bg-white/[0.03] p-2">
              <p className="text-[10px] uppercase tracking-widest text-parchment/50">{last.result.outcome.kind === 'fictional' ? 'What history actually did' : 'Historical context'}</p>
              <p className="mt-1 text-xs leading-relaxed text-parchment/80">{last.result.outcome.context}</p>
            </div>
            {last.result.outcome.sources.length > 0 && (
              <p className="text-[11px] text-parchment/55">Further reading: {last.result.outcome.sources.map((s) => sc.sources[s]?.label ?? s).join(' · ')}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <button data-testid="continue-story" onClick={() => goExplore(state)} className="rounded-md bg-gold-500 px-4 py-2 text-sm font-medium text-midnight-950 hover:bg-gold-400">
                {isEnded(state) ? 'See the ending' : 'Continue to the next event'}
              </button>
              <button onClick={replayCine} className="rounded-md border border-white/15 px-4 py-2 text-sm hover:border-gold-500/50">Replay cinematic</button>
            </div>
          </Panel>
        </div>
      )}

      {/* ending */}
      {mode === 'ending' && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/55 p-4" data-testid="ending">
          <Panel className="max-w-lg !p-8 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-gold-400">End of this timeline · {state.year}</p>
            <h2 className="mt-2 font-serif text-3xl">Your history</h2>
            <p className="mt-3 text-sm text-parchment/80">
              {sum.decisions} decisions: {sum.historical} followed documented history, {sum.fictional} diverged into alternate-history fiction.
            </p>
            <ol className="mt-3 space-y-1 text-left text-sm text-parchment/75">
              {state.history.map((h, i) => (
                <li key={i} className="flex items-center justify-between gap-2"><span>{h.year} · {h.choiceId}</span><Badge kind={h.kind} /></li>
              ))}
            </ol>
            <div className="mt-6 flex justify-center gap-3">
              <button onClick={() => rewind(Math.max(0, choices.length - 1))} className="rounded-md border border-white/20 px-4 py-2 text-sm hover:border-gold-500/50">Undo last decision</button>
              <button onClick={reset} className="rounded-md bg-gold-500 px-4 py-2 text-sm font-medium text-midnight-950 hover:bg-gold-400">Start a new timeline</button>
            </div>
          </Panel>
        </div>
      )}

      {/* timeline */}
      {mode !== 'briefing' && (
        <div className="absolute inset-x-0 bottom-0 z-30 px-6 pb-4" data-testid="timeline">
          <div className="relative mx-auto h-14 max-w-4xl">
            <div className="absolute left-0 right-0 top-7 h-px bg-white/20" />
            {sc.anchors.map((a, i) => (
              <div key={a.year} className="absolute top-5 -translate-x-1/2 text-center" style={{ left: pos(a.year) }} title={`${a.label} (documented reference)`}>
                <div className="mx-auto h-4 w-px bg-white/40" />
                {(i === 0 || a.year - sc.anchors[i - 1].year >= 3) && <p className="mt-0.5 whitespace-nowrap text-[10px] text-parchment/50">{a.year}</p>}
              </div>
            ))}
            {state.history.map((h, i) => (
              <button
                key={i}
                data-testid={`tl-step-${i}`}
                onClick={() => rewind(i)}
                disabled={mode === 'cinematic'}
                title={`${h.year}: ${h.choiceId} (${kindLabel(h.kind)}) — click to rewind to before this decision`}
                className={`absolute top-[1.4rem] h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 ${h.kind === 'historical' ? 'border-emerald-300 bg-emerald-500/60' : 'border-fuchsia-300 bg-fuchsia-500/60'} hover:scale-125`}
                style={{ left: pos(Math.min(y1, Math.max(y0, h.year))) }}
              />
            ))}
            <div className="absolute top-[1.1rem] h-5 w-0.5 -translate-x-1/2 bg-gold-400 transition-all duration-500" style={{ left: pos(Math.min(y1, Math.max(y0, shownYear))) }} />
            <p className="absolute left-0 top-0 text-[10px] uppercase tracking-widest text-parchment/40">
              Timeline · <span className="text-emerald-300">● documented</span> <span className="text-fuchsia-300">● alternate</span>
            </p>
          </div>
        </div>
      )}
      {failure && mode !== 'explore' && <p className="absolute left-1/2 top-16 z-40 -translate-x-1/2 rounded bg-red-900/80 px-3 py-1 text-xs" role="alert">{failure}</p>}
    </div>
  )
}
void TIMING
