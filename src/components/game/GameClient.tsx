'use client'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ApplyResult, FactionId, Scenario, WorldState } from '@/game/types'
import { affectedSites, applyChoice, availableChoices, capitalSite, chronicle, diffState, divergenceIndex, evaluateEnding, fingerprint, getNode, isEnded, replay, siteTerritory, statesAlong, summarize } from '@/game/engine'
import type { BranchSet } from '@/game/branches'
import { ORIGINAL_ID, activeBranch, allBranches, commitChoice, deleteAll, deleteBranch, emptySet, getBranch, loadSet, migrateRun, navigate, originalBranch, renameBranch } from '@/game/branches'
import { optionLabel } from '@/game/compare'
import { FACTION_NAME } from '@/game/factions'
import { sceneFrame, segments, totalDuration } from '@/game/choreography'
import { videoProviderStatus } from '@/game/media'
import MediaPlayer from './MediaPlayer'
import type { CinePhase, CinematicRun, Clock } from './World3D'
import WorldPanel from './hud/WorldPanel'
import Chronicle from './hud/Chronicle'
import type { StepMark } from './hud/Chronicle'
import DecisionPanel from './hud/DecisionPanel'
import type { ChoiceInfo } from './hud/DecisionPanel'
import ConsequencePanel from './hud/ConsequencePanel'
import type { LastResult } from './hud/ConsequencePanel'
import EndingCard from './hud/EndingCard'
import BranchDrawer from './hud/BranchDrawer'
import ComparePanel from './hud/ComparePanel'
import type { MapView } from './hud/ComparePanel'
import { Btn, KindBadge, Panel } from './hud/ui'

const World3D = dynamic(() => import('./World3D'), { ssr: false, loading: () => <div className="absolute inset-0 grid place-items-center text-parchment/60">Preparing the world…</div> })

type Mode = 'briefing' | 'explore' | 'cinematic' | 'consequence' | 'ending' | 'compare'
interface CineReq {
  result: ApplyResult
  before: WorldState
  /** choice id to record when the cinematic ends; null = view-only replay */
  commit: string | null
  returnTo: Mode
}

const storeKey = (id: string) => `whatif.branches.${id}`
const legacyKey = (id: string) => `whatif.run.${id}`
const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`)
const startsWith = (a: readonly string[], p: readonly string[]) => p.length <= a.length && p.every((x, i) => a[i] === x)

function siteLabels(sc: Scenario, s: WorldState): Record<string, string> {
  const cap = capitalSite(sc, s)
  const out: Record<string, string> = {}
  for (const site of sc.sites) {
    const v = sc.vars.find((x) => x.siteId === site.id && x.category === 'country')
    const t = siteTerritory(sc, site.id)
    const text = v ? optionLabel(v, s.vars[v.id]) : t ? FACTION_NAME[s.control[t] ?? 'neutral'] : ''
    out[site.id] = site.id === cap ? `★ Ottoman capital${v ? ' · ' + text : ''}` : text
  }
  return out
}

export default function GameClient({ scenario: sc }: { scenario: Scenario }) {
  const [set, setSet] = useState<BranchSet>(emptySet)
  const [loaded, setLoaded] = useState(false)
  const [mode, setMode] = useState<Mode>('briefing')
  const [cine, setCine] = useState<CineReq | null>(null)
  const [last, setLast] = useState<LastResult | null>(null)
  const [drawer, setDrawer] = useState(false)
  const [cmp, setCmp] = useState<{ a: string; b: string; map: MapView }>({ a: ORIGINAL_ID, b: ORIGINAL_ID, map: 'diff' })
  const [info, setInfo] = useState<{ type: 'site' | 'territory'; id: string } | null>(null)
  const [focus, setFocus] = useState<{ site: string; token: number }>({ site: sc.nodes[sc.start].siteId, token: 0 })
  const [phase, setPhase] = useState<CinePhase | null>(null)
  const [prog, setProg] = useState(0)
  const [caption, setCaption] = useState<string | null>(null)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [failure, setFailure] = useState('')
  const [notice, setNotice] = useState('')
  const [useVideo, setUseVideo] = useState(true)
  const [autoplay, setAutoplay] = useState(false)
  const [settledKey, setSettledKey] = useState('')
  const clock = useRef<Clock>({ t: 0, playing: false, speed: 1 })
  const fadeRef = useRef<HTMLDivElement | null>(null)
  const cineRef = useRef<CineReq | null>(null)
  cineRef.current = cine
  const setRef = useRef(set)
  setRef.current = set

  /* ---------- persistence ---------- */
  useEffect(() => {
    let next = emptySet()
    try {
      const raw = window.localStorage.getItem(storeKey(sc.id))
      if (raw) {
        const r = loadSet(sc, JSON.parse(raw))
        next = r.set
        if (r.repaired.length) setNotice(`Some saved branches no longer matched the scenario and were repaired: ${r.repaired.join(', ')}.`)
      } else {
        const old = window.localStorage.getItem(legacyKey(sc.id))
        if (old) next = migrateRun(sc, JSON.parse(old), Date.now(), newId)
      }
    } catch {
      next = emptySet()
    }
    setSet(next)
    setLoaded(true)
  }, [sc])
  const persist = useCallback(
    (next: BranchSet) => {
      setRef.current = next
      setSet(next)
      try {
        window.localStorage.setItem(storeKey(sc.id), JSON.stringify(next))
      } catch {
        /* storage unavailable: branches stay in memory */
      }
    },
    [sc.id],
  )
  useEffect(() => {
    if (!notice) return
    const id = setTimeout(() => setNotice(''), 6000)
    return () => clearTimeout(id)
  }, [notice])

  /* ---------- derived timeline ---------- */
  const active = activeBranch(sc, set)
  const isOriginal = active.id === ORIGINAL_ID
  const all = allBranches(sc, set)
  const cursor = Math.min(set.cursor, active.choices.length)
  const states = useMemo(() => statesAlong(sc, active.choices), [sc, active.choices])
  const state = states[cursor]
  const prev = cursor > 0 ? states[cursor - 1] : null
  const node = getNode(sc, state)
  const ending = evaluateEnding(sc, state)
  const sum = summarize(state)
  const divergeAt = useMemo(() => divergenceIndex(sc, active.choices), [sc, active.choices])
  const chronOrig = useMemo(() => chronicle(sc, originalBranch(sc).choices), [sc])
  const chronBranch = useMemo(() => (isOriginal ? null : chronicle(sc, active.choices)), [sc, active.choices, isOriginal])
  const divergeYear = useMemo(() => {
    if (divergeAt < 0 || !chronBranch) return null
    const ys = chronBranch.filter((e) => e.step >= divergeAt).map((e) => e.year)
    return ys.length ? Math.min(...ys) : null
  }, [divergeAt, chronBranch])
  const steps: StepMark[] = useMemo(
    () =>
      states.slice(1).map((s, i) => {
        const h = s.history[i]
        const n = sc.nodes[h.nodeId]
        return { year: n.year, kind: h.kind, diverged: h.diverged, label: n.choices.find((c) => c.id === h.choiceId)?.label ?? h.choiceId, nodeTitle: n.title }
      }),
    [sc, states],
  )
  const choiceInfos: ChoiceInfo[] = node
    ? availableChoices(sc, state).map(({ choice, locked }) => {
        const path = [...active.choices.slice(0, cursor), choice.id]
        const taken = active.choices[cursor] === choice.id
        const other = all.find((b) => b.id !== active.id && startsWith(b.choices, path))
        const atEnd = !isOriginal && cursor === active.choices.length
        return { choice, locked, taken, exploredIn: other ? other.name : null, forks: !taken && !other && !atEnd }
      })
    : []

  /* ---------- cinematic ---------- */
  const startCine = (req: CineReq) => {
    setCine(req)
    setUseVideo(true)
    setFailure('')
    clock.current = { t: 0, playing: true, speed }
    lastProg.current = -1
    setPlaying(true)
    setProg(0)
    setCaption(null)
    setInfo(null)
    setDrawer(false)
    setMode('cinematic')
  }
  const choose = (id: string) => {
    if (mode === 'cinematic') return
    try {
      const r = applyChoice(sc, state, id)
      startCine({ result: r, before: state, commit: id, returnTo: 'consequence' })
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'That decision is not available.')
    }
  }
  const watch = (branchId: string, step: number, returnTo: Mode) => {
    const b = getBranch(sc, set, branchId)
    const st = statesAlong(sc, b.choices)
    if (step >= b.choices.length || !st[step]) return
    setAutoplay(false)
    startCine({ result: applyChoice(sc, st[step], b.choices[step]), before: st[step], commit: null, returnTo })
  }
  const finish = useCallback(() => {
    const req = cineRef.current
    if (!req) return
    const aff = affectedSites(sc, req.before, req.result.state, req.result.node.siteId)
    if (req.commit) {
      const out = commitChoice(sc, setRef.current, req.commit, Date.now(), newId)
      if (out.error) {
        setFailure(out.error)
        setAutoplay(false)
        setCine(null)
        setPhase(null)
        setMode('explore')
        return
      }
      persist(out.set)
      setLast({ result: req.result, before: req.before, commit: out.kind, branchName: getBranch(sc, out.set, out.branchId).name, viewOnly: false, affected: aff })
      setMode('consequence')
    } else {
      setLast({ result: req.result, before: req.before, commit: null, branchName: '', viewOnly: true, affected: aff })
      setMode(req.returnTo === 'compare' ? 'compare' : 'consequence')
    }
    setCine(null)
    setPhase(null)
  }, [sc, persist])
  const finishRef = useRef(finish)
  finishRef.current = finish
  const onEnd = useCallback(() => finishRef.current(), [])
  const lastProg = useRef(-1)
  const onPhase = useCallback((p: CinePhase, t: number) => {
    setPhase((x) => (x === p ? x : p))
    if (Math.abs(t - lastProg.current) > 0.08) {
      lastProg.current = t
      setProg(t)
      const s = cineRef.current?.result.outcome.cinematic
      if (s) {
        const seg = segments(s)
        setCaption(t >= seg.sceneStart && t <= seg.sceneEnd ? sceneFrame(s, Math.min(s.duration, Math.max(0, t - seg.sceneStart))).caption : null)
      }
    }
  }, [])
  const setT = (t: number) => {
    clock.current.t = t
    lastProg.current = -1
  }
  const togglePlay = useCallback(() => {
    clock.current.playing = !clock.current.playing
    setPlaying(clock.current.playing)
  }, [])
  const changeSpeed = (s: number) => {
    clock.current.speed = s
    setSpeed(s)
  }

  /* ---------- navigation ---------- */
  const enterAt = (next: BranchSet) => {
    const b = getBranch(sc, next, next.activeId)
    const s = replay(sc, b.choices.slice(0, next.cursor)).state
    const n = getNode(sc, s)
    setLast(null)
    setInfo(null)
    setFailure('')
    setMode(n ? 'explore' : 'ending')
    if (n) setFocus((f) => ({ site: n.siteId, token: f.token + 1 }))
  }
  const navTo = (branchId: string, c: number) => {
    if (mode === 'cinematic') return
    setAutoplay(false)
    const next = navigate(sc, set, branchId, c)
    persist(next)
    setDrawer(false)
    enterAt(next)
  }
  const goExplore = () => enterAt(setRef.current)
  const restart = () => {
    setAutoplay(false)
    setCine(null)
    setPhase(null)
    persist(navigate(sc, set, ORIGINAL_ID, 0))
    setLast(null)
    setInfo(null)
    setDrawer(false)
    setMode('briefing')
    setFocus((f) => ({ site: sc.nodes[sc.start].siteId, token: f.token + 1 }))
  }
  const replayBranch = (id: string) => {
    const b = getBranch(sc, set, id)
    if (!b.choices.length) return navTo(id, 0)
    const next = navigate(sc, set, id, 0)
    persist(next)
    setAutoplay(true)
    const s0 = replay(sc, []).state
    startCine({ result: applyChoice(sc, s0, b.choices[0]), before: s0, commit: b.choices[0], returnTo: 'consequence' })
  }
  useEffect(() => {
    if (!autoplay || mode !== 'consequence') return
    if (cursor >= active.choices.length) {
      setAutoplay(false)
      return
    }
    const id = setTimeout(() => choose(active.choices[cursor]), 3500)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, mode, cursor, active.choices])
  const pick = (prefix: string[]) => {
    const pool = [active, ...all]
    const hit = pool.find((b) => startsWith(b.choices, prefix))
    if (hit) return navTo(hit.id, prefix.length)
    for (let k = prefix.length - 1; k >= 0; k--) {
      const anc = pool.find((b) => startsWith(b.choices, prefix.slice(0, k)))
      if (anc) {
        navTo(anc.id, k)
        const label = getNode(sc, replay(sc, prefix.slice(0, k)).state)?.choices.find((c) => c.id === prefix[k])?.label
        setNotice(`Choose “${label}” to explore this path.`)
        return
      }
    }
  }
  const openCompare = (bId?: string) => {
    setAutoplay(false)
    const b = bId ?? (isOriginal ? set.branches[set.branches.length - 1]?.id ?? ORIGINAL_ID : active.id)
    setCmp({ a: ORIGINAL_ID, b, map: 'diff' })
    setDrawer(false)
    setLast(null)
    setInfo(null)
    setMode('compare')
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      if (e.key === ' ' && mode === 'cinematic') {
        e.preventDefault()
        togglePlay()
      } else if (e.key === 'Escape') {
        if (drawer) setDrawer(false)
        else if (mode === 'compare') enterAt(setRef.current)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, drawer, togglePlay])

  /* ---------- what the globe shows ---------- */
  const cmpStates = useMemo(
    () => (mode === 'compare' ? { A: replay(sc, getBranch(sc, set, cmp.a).choices).state, B: replay(sc, getBranch(sc, set, cmp.b).choices).state } : null),
    [mode, sc, set, cmp.a, cmp.b],
  )
  let shownState: WorldState = state
  let highlight: string[] = []
  let affected: string[] = []
  if (mode === 'compare' && cmpStates) {
    shownState = cmp.map === 'a' ? cmpStates.A : cmpStates.B
    if (cmp.map === 'diff') {
      highlight = sc.territories.filter((t) => cmpStates.A.control[t.id] !== cmpStates.B.control[t.id]).map((t) => t.id)
      affected = affectedSites(sc, cmpStates.A, cmpStates.B)
    }
  } else if (mode === 'consequence' && last) {
    shownState = last.result.state
    highlight = diffState(last.before, last.result.state).control.map((c) => c.territory)
    affected = last.affected
  } else if (mode === 'explore' && prev) {
    highlight = diffState(prev, state).control.map((c) => c.territory)
    affected = affectedSites(sc, prev, state)
  }
  const display: Record<string, FactionId> = shownState.control
  const displayKey = sc.territories.map((t) => display[t.id]).join(',')
  const labels = useMemo(() => siteLabels(sc, shownState), [sc, shownState])
  const run = useMemo<CinematicRun | null>(() => (cine ? { spec: cine.result.outcome.cinematic, siteId: cine.result.node.siteId, before: cine.before.control, after: cine.result.state.control } : null), [cine])
  const media = cine?.result.outcome.media
  const showVideo = mode === 'cinematic' && !!media && useVideo
  const total = cine ? totalDuration(cine.result.outcome.cinematic) : 1
  const shownYear =
    mode === 'cinematic' && cine ? Math.round(cine.before.year + (cine.result.outcome.endYear - cine.before.year) * Math.min(1, Math.max(0, prog / total))) : mode === 'compare' && cmpStates ? shownState.year : shownState.year
  const panelState = mode === 'cinematic' && cine ? (phase === 'result' ? cine.result.afterChoice : cine.before) : mode === 'consequence' && last ? last.result.state : state
  const panelPrev = mode === 'cinematic' && cine ? (phase === 'result' ? cine.before : null) : mode === 'consequence' && last ? last.before : prev

  const infoBody = (() => {
    if (!info) return null
    if (info.type === 'site') {
      const s = sc.sites.find((x) => x.id === info.id)
      if (!s) return null
      const t = siteTerritory(sc, s.id)
      const vars = sc.vars.filter((v) => v.siteId === s.id && !(v.hiddenWhen && shownState.vars[v.id] === v.hiddenWhen))
      const events = (chronBranch ?? chronOrig).filter((e) => e.siteId === s.id && (e.step < cursor || !chronBranch))
      return { title: s.name, tag: 'Location', text: s.blurb, lines: [...(t ? [`Region: ${FACTION_NAME[shownState.control[t]]}`] : []), ...(capitalSite(sc, shownState) === s.id ? ['★ Ottoman seat of power'] : []), ...vars.map((v) => `${v.label}: ${optionLabel(v, shownState.vars[v.id])}`)], events }
    }
    const t = sc.territories.find((x) => x.id === info.id)
    if (!t) return null
    const sites = sc.sites.filter((s) => siteTerritory(sc, s.id) === t.id).map((s) => s.name)
    return { title: t.name, tag: 'Schematic region, not a historical border', text: t.note, lines: [`Controlled by: ${FACTION_NAME[shownState.control[t.id] ?? t.initial]}`, ...(sites.length ? [`Places: ${sites.join(', ')}`] : [])], events: [] }
  })()

  const hasProgress = set.branches.length > 0 || cursor > 0

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-[#05070d] text-parchment"
      data-testid="game-root"
      data-mode={mode}
      data-phase={phase ?? ''}
      data-branch={active.id}
      data-branches={set.branches.length}
      data-cursor={cursor}
      data-decisions={cursor}
      data-year={shownYear}
      data-fingerprint={fingerprint(state)}
      data-map-expected={displayKey}
      data-map-settled={settledKey}
      data-ending={ending?.id ?? ''}
    >
      <div className="absolute inset-0">
        {loaded && (
          <World3D
            scenario={sc}
            display={display}
            displayKey={displayKey}
            highlight={highlight}
            affected={affected}
            labels={labels}
            viewShift={mode === 'compare' ? 0.2 : mode === 'explore' || mode === 'consequence' ? 0.07 : 0}
            capitalSiteId={capitalSite(sc, mode === 'cinematic' && cine ? (phase === 'result' ? cine.result.state : cine.before) : shownState)}
            decisionSiteId={mode === 'explore' && node ? node.siteId : null}
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
            onMapSettled={setSettledKey}
          />
        )}
      </div>
      <div ref={fadeRef} className="pointer-events-none absolute inset-0 z-10 bg-black opacity-0" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-24 bg-gradient-to-b from-black/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-40 bg-gradient-to-t from-black/75 to-transparent" />

      {/* top HUD */}
      <header className="absolute inset-x-0 top-0 z-[45] flex items-start gap-3 p-4">
        <Link href="/" className="pointer-events-auto font-serif text-lg tracking-[0.2em] text-gold-400 hover:text-gold-300">
          WHATIF
        </Link>
        <div className="hidden min-w-0 flex-1 sm:block">
          <p className="truncate font-serif text-lg text-parchment">{sc.title}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-parchment/60">
            <button
              data-testid="branch-chip"
              onClick={() => mode !== 'cinematic' && setDrawer(true)}
              className={`pointer-events-auto flex max-w-[22rem] items-center gap-1.5 rounded-full border px-2 py-0.5 ${isOriginal ? 'border-emerald-400/40 text-emerald-200' : 'border-fuchsia-400/40 text-fuchsia-100'} hover:bg-white/5`}
            >
              <span className={`h-2 w-2 rounded-full ${isOriginal ? 'bg-emerald-400' : 'bg-fuchsia-400'}`} />
              <span className="truncate">{active.name}</span>
              <span className="text-parchment/40">▾</span>
            </button>
            <span data-testid="progress">
              {node ? `Decision ${cursor + 1}` : `${cursor} decisions`}
              {cursor < steps.length ? (isOriginal ? ` of ${steps.length} on the documented path` : ` (of ${steps.length} recorded)`) : ''} · {sum.historical} documented · {sum.fictional} alternate · endings {set.discovered.length}/{sc.endings.length}
            </span>
            {autoplay && (
              <button className="pointer-events-auto rounded bg-gold-500/20 px-2 py-0.5 text-gold-200" onClick={() => setAutoplay(false)} data-testid="stop-autoplay">
                ▶ Replaying timeline · stop
              </button>
            )}
          </div>
        </div>
        <div className="ml-auto text-right">
          <p className="font-serif text-3xl tabular-nums text-gold-300" data-testid="year">{shownYear}</p>
        </div>
        <div className="pointer-events-auto flex gap-1.5">
          <Btn className="!px-2.5 !text-xs" onClick={() => setDrawer(true)} disabled={mode === 'cinematic' || mode === 'briefing'} data-testid="open-branches">Timelines</Btn>
          <Btn className="!px-2.5 !text-xs" onClick={() => openCompare()} disabled={mode === 'cinematic' || mode === 'briefing'} data-testid="open-compare">Compare</Btn>
          <Btn className="!px-2.5 !text-xs" onClick={restart} data-testid="reset">Restart</Btn>
        </div>
      </header>

      {notice && (
        <div className="absolute left-1/2 top-20 z-[46] -translate-x-1/2" role="status" data-testid="notice">
          <p className="wi-in rounded-full border border-gold-500/30 bg-midnight-950/90 px-4 py-1.5 text-xs text-parchment/90">{notice}</p>
        </div>
      )}

      {/* world state */}
      {mode !== 'briefing' && mode !== 'compare' && (
        <div className="absolute bottom-36 left-4 top-24 z-30 hidden w-60 md:block">
          <WorldPanel sc={sc} state={panelState} prev={panelPrev} />
        </div>
      )}

      {infoBody && (mode === 'explore' || mode === 'consequence' || mode === 'compare') && (
        <div className="absolute left-1/2 top-24 z-[35] w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 md:left-[17rem] md:translate-x-0" data-testid="info-panel">
          <Panel className="wi-in !p-3">
            <p className="text-[10px] uppercase tracking-widest text-gold-400">{infoBody.tag}</p>
            <p className="font-serif text-lg">{infoBody.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-parchment/75">{infoBody.text}</p>
            {infoBody.lines.map((l) => (
              <p key={l} className="text-xs text-parchment/85">{l}</p>
            ))}
            {infoBody.events.length > 0 && (
              <div className="mt-2 border-t border-white/10 pt-1">
                <p className="text-[10px] uppercase tracking-widest text-parchment/45">Here, in this timeline</p>
                {infoBody.events.map((e, i) => (
                  <p key={i} className="text-[11px] text-parchment/75">
                    <span className="text-gold-300/80">{e.date}</span> {e.title} <span className={e.kind === 'historical' ? 'text-emerald-300/70' : 'text-fuchsia-300/70'}>{e.kind === 'historical' ? '· documented' : '· fiction'}</span>
                  </p>
                ))}
              </div>
            )}
            <button className="mt-2 text-[11px] text-parchment/50 hover:text-parchment" onClick={() => setInfo(null)}>Close</button>
          </Panel>
        </div>
      )}

      {/* briefing */}
      {mode === 'briefing' && loaded && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/55 p-4">
          <Panel className="wi-in max-w-xl !p-8 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-gold-400">Scenario · {sc.startYear}</p>
            <h1 className="mt-2 font-serif text-3xl text-parchment">{sc.title}</h1>
            <p className="mt-1 italic text-parchment/70">{sc.tagline}</p>
            <p className="mt-4 text-sm leading-relaxed text-parchment/80">{sc.premise}</p>
            <p className="mt-3 text-xs text-parchment/50">
              You start on the original, documented timeline. Change any decision and a new branch of history opens; your other timelines are kept, and you can compare any of them with what really happened. Regions on the globe are schematic.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {hasProgress && (
                <Btn primary data-testid="continue" onClick={goExplore} className="!px-5 !py-2.5">
                  Continue: {active.name.replace(/^What if: /, '')}
                </Btn>
              )}
              <Btn data-testid="begin" primary={!hasProgress} className="!px-5 !py-2.5" onClick={() => navTo(ORIGINAL_ID, 0)}>
                {hasProgress ? `Start from ${sc.startYear}` : 'Enter the world'}
              </Btn>
              {set.branches.length > 0 && <Btn className="!px-5 !py-2.5" onClick={() => setDrawer(true)}>My timelines ({set.branches.length})</Btn>}
            </div>
            <p className="mt-4 text-[11px] text-parchment/40">{videoProviderStatus().message}</p>
          </Panel>
        </div>
      )}

      {/* decision */}
      {mode === 'explore' && node && (
        <div className="absolute bottom-36 right-4 top-24 z-30 flex w-[min(30rem,calc(100vw-2rem))] flex-col justify-end" data-testid="decision-panel">
          <DecisionPanel sc={sc} node={node} state={state} choices={choiceInfos} revisiting={cursor < active.choices.length} diverged={sum.diverged} failure={failure} onChoose={choose} />
        </div>
      )}

      {/* cinematic */}
      {mode === 'cinematic' && cine && (
        <>
          <div className="absolute inset-x-0 top-24 z-30 flex justify-center px-4">
            <div className="pointer-events-none max-w-xl text-center">
              <KindBadge kind={cine.result.outcome.kind} echo={cine.result.choice.historical && cine.result.state.history[cine.result.state.history.length - 1].diverged} />
              <p className="mt-2 font-serif text-2xl text-parchment drop-shadow">{cine.result.outcome.title}</p>
              <p className="text-[11px] uppercase tracking-widest text-parchment/50" data-testid="cine-phase">
                {!cine.commit && 'Replay · '}
                {phase === 'fly' ? 'Travelling to the location' : phase === 'scene' ? 'Reconstruction (real-time 3D, schematic)' : 'Consequences spread across the map'}
              </p>
            </div>
          </div>
          {phase === 'scene' && caption && (
            <div className="pointer-events-none absolute inset-x-0 bottom-48 z-30 flex justify-center px-4">
              <p className="max-w-2xl rounded bg-black/70 px-4 py-2 text-center text-sm text-parchment" data-testid="caption">{caption}</p>
            </div>
          )}
          {showVideo && media && (
            <div className="absolute inset-0 z-40 grid place-items-center bg-black/80 p-4">
              <div className="w-full max-w-3xl space-y-3">
                <MediaPlayer media={media} title={cine.result.outcome.title} fictional={cine.result.outcome.kind === 'fictional'} onEnded={finish} onFallback={() => setUseVideo(false)} />
                <button onClick={() => setUseVideo(false)} className="text-sm text-parchment/70 underline">Watch the real-time 3D cinematic instead</button>
              </div>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-32 z-30 flex justify-center px-4">
            <Panel className="flex w-full max-w-2xl items-center gap-3 !p-2.5">
              <button onClick={togglePlay} data-testid="play-pause" className="w-20 rounded border border-white/15 py-1 text-sm hover:border-gold-500/50">{playing ? 'Pause' : 'Resume'}</button>
              <input aria-label="Cinematic position" data-testid="seek" type="range" min={0} max={total} step={0.05} value={Math.min(prog, total)} onChange={(e) => setT(Number(e.target.value))} className="h-1 flex-1 accent-[#d4b66c]" />
              {[0.5, 1, 2].map((s) => (
                <button key={s} onClick={() => changeSpeed(s)} className={`rounded border px-2 py-1 text-xs ${speed === s ? 'border-gold-500/60 text-gold-300' : 'border-white/15'}`}>{s}×</button>
              ))}
              <button onClick={() => setT(total - 0.001)} data-testid="skip" className="rounded border border-white/15 px-2 py-1 text-xs hover:border-gold-500/50">Skip</button>
            </Panel>
          </div>
        </>
      )}

      {/* consequence */}
      {mode === 'consequence' && last && (
        <div className="absolute bottom-36 right-4 top-24 z-30 flex w-[min(34rem,calc(100vw-2rem))] flex-col justify-end">
          <ConsequencePanel
            sc={sc}
            last={last}
            ended={!last.viewOnly && isEnded(state)}
            onContinue={goExplore}
            onReplay={() => {
              setAutoplay(false)
              startCine({ result: last.result, before: last.before, commit: null, returnTo: 'consequence' })
            }}
            onCompare={last.result.state.history.some((h) => h.diverged) && !last.viewOnly ? () => openCompare(active.id) : null}
            onSite={(id) => {
              setInfo({ type: 'site', id })
              setFocus((f) => ({ site: id, token: f.token + 1 }))
            }}
          />
        </div>
      )}

      {/* ending */}
      {mode === 'ending' && !drawer && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/50 p-4">
          <EndingCard
            sc={sc}
            state={state}
            ending={ending}
            discovered={set.discovered}
            branchName={active.name}
            isOriginal={isOriginal}
            onCompare={() => openCompare(active.id)}
            onBranches={() => setDrawer(true)}
            onReplay={() => replayBranch(active.id)}
            onRestart={restart}
          />
        </div>
      )}

      {/* compare */}
      {mode === 'compare' && (
        <div className="absolute bottom-4 right-4 top-20 z-30 w-[min(46rem,calc(100vw-2rem))]">
          <ComparePanel sc={sc} set={set} a={cmp.a} b={cmp.b} map={cmp.map} onChange={(x) => setCmp((c) => ({ ...c, ...x }))} onWatch={(id, step) => watch(id, step, 'compare')} onClose={goExplore} />
        </div>
      )}
      {mode === 'compare' && (
        <div className="pointer-events-none absolute bottom-6 left-4 z-30 hidden max-w-[calc(100vw-50rem)] text-xs text-parchment/70 lg:block">
          <p className="rounded bg-black/60 px-3 py-1.5">
            Globe: <b className="text-gold-200">{cmp.map === 'a' ? getBranch(sc, set, cmp.a).name : cmp.map === 'b' ? getBranch(sc, set, cmp.b).name : 'differences outlined in gold'}</b> · drag to rotate
          </p>
        </div>
      )}

      {/* timeline */}
      {mode !== 'briefing' && mode !== 'compare' && (
        <div className="absolute inset-x-0 bottom-0 z-30 px-4 pb-3">
          <Chronicle
            original={chronOrig}
            branch={chronBranch}
            branchName={active.name}
            steps={steps}
            cursor={cursor}
            divergeYear={divergeYear}
            shownYear={shownYear}
            anchors={sc.anchors.map((a) => a.year)}
            disabled={mode === 'cinematic'}
            onNavigate={(c) => navTo(active.id, c)}
          />
        </div>
      )}

      {drawer && (
        <BranchDrawer
          sc={sc}
          set={set}
          onClose={() => setDrawer(false)}
          onOpen={(id) => navTo(id, getBranch(sc, set, id).choices.length)}
          onCompare={(id) => openCompare(id)}
          onReplay={replayBranch}
          onDelete={(id) => {
            const next = deleteBranch(set, id)
            persist(next)
            if (id === active.id) enterAt(next)
          }}
          onDeleteAll={() => {
            const next = deleteAll(set)
            persist(next)
            enterAt(next)
          }}
          onRename={(id, name) => persist(renameBranch(set, id, name, Date.now()))}
          onNew={() => navTo(ORIGINAL_ID, 0)}
          onPick={pick}
        />
      )}
      {failure && mode !== 'explore' && <p className="absolute left-1/2 top-16 z-40 -translate-x-1/2 rounded bg-red-900/80 px-3 py-1 text-xs" role="alert">{failure}</p>}
    </div>
  )
}
