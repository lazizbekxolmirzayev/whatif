export type Era = 'Ancient' | 'Medieval' | 'Early Modern' | 'Modern' | 'Contemporary'

/** Everything in `HistoricalEvent` except `scenarios` is presented as VERIFIED history. */
export interface Pivot {
  question: string
  /** What actually happened at the decision point. */
  actual: string
  /** Counterfactual choices that a user could explore. */
  alternatives: string[]
}

/** Everything inside a `Scenario` is FICTIONAL speculation, never history. */
export interface ScenarioChapter {
  horizon: string
  text: string
}

export interface Scenario {
  id: string
  title: string
  premium: boolean
  premise: string
  /** What would have had to be true for this branch to be plausible. */
  assumptions: string[]
  chapters: ScenarioChapter[]
}

export interface HistoricalEvent {
  id: string
  title: string
  /** Negative = BCE. Used for sorting only. */
  year: number
  dateLabel: string
  era: Era
  region: string
  place: string
  lat: number
  lng: number
  summary: string
  verifiedFacts: string[]
  pivot: Pivot
  /** Real structural factors that shaped the outcome; used as prompts in Create Your Own History. */
  factors: string[]
  scenarios: Scenario[]
  related?: string[]
}

export type Plan = 'free' | 'premium'

export interface User {
  id: string
  name: string
  email: string
  plan: Plan
  createdAt: number
}

export interface CustomCharacter {
  name: string
  role: string
  traits: string[]
  motivation: string
}

export interface CustomBranch {
  id: string
  userId: string
  eventId: string
  title: string
  change: string
  character: CustomCharacter | null
  ripples: { horizon: string; text: string }[]
  createdAt: number
}
