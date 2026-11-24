/**
 * WHATIF game contracts. Pure data + types: no React, no DOM, no randomness.
 * Anything labelled 'fictional' is alternate-history speculation, never a historical claim.
 */
export type Kind = 'historical' | 'fictional'
export type FactionId = 'ottoman' | 'timurid' | 'byzantine' | 'beylik' | 'rumelian' | 'neutral'
export type StatId = 'ottomanPower' | 'timuridReach' | 'byzantineSecurity' | 'stability'
export type Stats = Record<StatId, number>

export interface SourceRef {
  id: string
  label: string
  kind: 'scholarship' | 'chronicle'
}

/** Schematic region drawn as a coloured cap on the globe. NOT a historical border. */
export interface Territory {
  id: string
  name: string
  lat: number
  lng: number
  /** angular radius in degrees */
  radius: number
  initial: FactionId
  note: string
}

export interface Site {
  id: string
  name: string
  lat: number
  lng: number
  blurb: string
}

export type Effect =
  | { type: 'control'; territory: string; to: FactionId }
  | { type: 'stat'; stat: StatId; delta: number }
  | { type: 'flag'; flag: string }

export interface Requirement {
  flags?: string[]
  notFlags?: string[]
  stat?: { id: StatId; min: number }
}

export interface Caption {
  /** fractions of scene duration, 0..1 */
  from: number
  to: number
  text: string
}

export interface SideSpec {
  faction: FactionId
  count: number
  label: string
}

export type CinematicTemplate = 'battle' | 'siege' | 'parley'
export type CinematicResult = 'a' | 'b' | 'a-withdraws' | 'b-withdraws' | 'falls' | 'holds' | 'agreement'

/** Declarative description of a real-time 3D scene. Interpreted by choreography.ts. */
export interface CinematicSpec {
  template: CinematicTemplate
  terrain: 'steppe' | 'plain' | 'coast'
  seed: number
  /** seconds of in-engine scene time at 1x speed */
  duration: number
  a: SideSpec
  b: SideSpec
  result: CinematicResult
  defect?: { count: number; toFaction: FactionId; atP: number; label: string }
  captureLeader?: boolean
  commanderFalls?: boolean
  captions: Caption[]
}

/** Optional pre-rendered or provider-generated video. No outcome ships with one. */
export interface MediaRef {
  videoUrl: string
  posterUrl?: string
  captionsUrl?: string
  description?: string
}

export interface Outcome {
  title: string
  kind: Kind
  /** one sentence describing what the viewer sees in the cinematic */
  visual: string
  immediate: string[]
  longTerm: string[]
  /** what is documented (historical outcome) or what history actually did (fictional outcome) */
  context: string
  sources: string[]
  cinematic: CinematicSpec
  media?: MediaRef
  endYear: number
}

export interface NextRule {
  whenFlags?: string[]
  whenNotFlags?: string[]
  goto: string | null
}

export interface Choice {
  id: string
  label: string
  summary: string
  historical: boolean
  requires?: Requirement
  lockedReason?: string
  effects: Effect[]
  outcome: Outcome
  next: NextRule[]
}

export interface DecisionNode {
  id: string
  title: string
  dateLabel: string
  year: number
  siteId: string
  situation: string
  /** extra lines shown when the flag is set; makes earlier decisions visible in later situations */
  variants?: { flag: string; text: string }[]
  question: string
  choices: Choice[]
}

export interface Scenario {
  id: string
  title: string
  tagline: string
  premise: string
  startYear: number
  territories: Territory[]
  sites: Site[]
  nodes: Record<string, DecisionNode>
  start: string
  initialStats: Stats
  initialControl: Record<string, FactionId>
  sources: Record<string, SourceRef>
  /** timeline ticks for documented dates, shown as neutral reference marks */
  anchors: { year: number; label: string }[]
}

export interface Step {
  nodeId: string
  choiceId: string
  kind: Kind
  year: number
}

export interface WorldState {
  year: number
  node: string | null
  control: Record<string, FactionId>
  flags: Record<string, true>
  stats: Stats
  history: Step[]
}

export interface ApplyResult {
  state: WorldState
  node: DecisionNode
  choice: Choice
  outcome: Outcome
}

/* ---------- Cinematic frame types (output of choreography.ts) ---------- */
export type Vec3 = [number, number, number]
export type GroupMode = 'idle' | 'advance' | 'clash' | 'rout' | 'cheer' | 'fallen'

export interface GroupFrame {
  id: string
  role: 'army' | 'leader'
  faction: FactionId
  /** optional colour crossfade, used when a contingent changes sides */
  mixTo?: FactionId
  mixK: number
  x: number
  z: number
  facing: number
  spread: number
  alive: number
  mode: GroupMode
  count: number
  seed: number
  shape: 'block' | 'line'
}

export interface SceneFrame {
  progress: number
  groups: GroupFrame[]
  wall: { x: number; length: number; breach: number } | null
  cannon: { x: number; z: number; fire: number } | null
  dust: { x: number; z: number; intensity: number }
  shake: number
  camera: { pos: Vec3; look: Vec3 }
  caption: string | null
}
