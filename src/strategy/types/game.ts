// Core simulation types. The engine (src/engine) depends only on these types and
// static data; it never imports React, the DOM or any service, so the same code
// can run in the browser, in tests and in the server-authoritative edge function.

export interface GameDate { y: number; m: number } // m: 0..11

export type CountryId = string;
export type MacroRegion =
  | 'europe' | 'mena' | 'ssafrica' | 'southasia' | 'eastasia' | 'seasia'
  | 'centralasia' | 'russia' | 'namerica' | 'latam' | 'oceania';

export type EraId = 'ancient' | 'classical' | 'medieval' | 'renaissance' | 'industrial' | 'modern';
export type GovernmentId =
  | 'tribal' | 'monarchy' | 'empire' | 'republic' | 'theocracy' | 'merchant_republic'
  | 'khaganate' | 'constitutional_monarchy' | 'democracy' | 'one_party_state' | 'military_junta';
export type Difficulty = 'story' | 'normal' | 'hard' | 'ironman';

export interface FlagDesign {
  pattern: 'solid' | 'hbi' | 'htri' | 'vtri' | 'vbi' | 'nordic' | 'saltire' | 'canton' | 'diagonal' | 'border' | 'quartered' | 'stripes';
  colors: [string, string, string];
  emblem: 'none' | 'star' | 'crescent' | 'sun' | 'cross' | 'circle' | 'crown' | 'eagle' | 'rings' | 'tower' | 'lion' | 'wheel';
  emblemColor: string;
}

export interface Character {
  name: string;
  title: string;
  born: number; // year
  health: number; // 0..100
  skill: { admin: number; diplomacy: number; military: number }; // 0..10
  traits: string[];
  historical?: boolean; // documented historical person
}

export interface Modifier {
  id: string;
  label: string;
  until: number; // absolute month index (y*12+m); Infinity-like = 1e9
  effects: Partial<Record<ModifierKey, number>>;
  source?: string;
}
export type ModifierKey =
  | 'taxEfficiency' | 'tradeIncome' | 'foodProduction' | 'popGrowth' | 'stability'
  | 'research' | 'militaryQuality' | 'morale' | 'deathRate' | 'unrest' | 'inflation' | 'legitimacy' | 'manpower';

export interface Budget {
  military: number; infrastructure: number; research: number; health: number; agriculture: number; administration: number;
}
export type BudgetKey = keyof Budget;

export interface Economy {
  treasury: number;
  taxRate: number; // 0..0.6
  budget: Budget; // shares of spending (sum normalized to 1)
  spendingRate: number; // fraction of income spent on budget (0..1.5)
  gdp: number; // annualized
  income: number; // monthly
  expenses: number; // monthly
  tradeIncome: number; // monthly
  inflation: number; // annual %, e.g. 0.02
  debt: number;
  interestRate: number;
  lastBalance: number;
}

export interface FoodState {
  stock: number; // person-months of food
  production: number; // monthly, persons fed
  consumption: number;
  storageMonths: number; // capacity in months of consumption
  famineMonths: number;
  imports: number;
  weather: number; // multiplier (droughts etc.)
  shortage: number; // 0..1 share of consumption unmet last month
}

export interface PopulationStats {
  total: number;
  births: number; // last month
  deaths: number; // last month
  migration: number; // last month net
  urbanization: number; // 0..1
  growthRate: number; // annualized
  famineDeaths: number; // cumulative
  epidemicDeaths: number; // cumulative
  warDeaths: number; // cumulative
}

export interface Epidemic { name: string; severity: number; monthsLeft: number; origin: number }
export interface HealthState { care: number; sanitation: number; medicine: number; epidemic: Epidemic | null }

export interface TechState {
  points: number; // research points accumulated toward current tech
  known: string[];
  researching: string | null;
  education: number; // 0..100
  institutions: number; // count of universities/academies
  lastOutput: number;
}

export interface StabilityState {
  value: number; // 0..100
  satisfaction: number; // 0..100
  legitimacy: number; // 0..100
  unrest: number; // 0..100 average
  rebellion: number; // 0..100 progress toward revolt
  warExhaustion: number; // 0..100
}

export interface MilitaryState {
  regiments: number; // standing troops in thousands
  manpower: number; // thousands available
  maxManpower: number;
  quality: number; // multiplier from tech/training
  morale: number; // 0..1
  supply: number; // 0..1 logistics readiness
  forts: number; // avg fortification
  losses: number; // cumulative
  doctrine: 'defensive' | 'balanced' | 'offensive';
}

export interface AIPersonality { aggression: number; diplomacy: number; economy: number; expansion: number }
export interface AIDecision { date: GameDate; kind: string; summary: string; reason: string }

export interface Country {
  id: CountryId;
  name: string;
  color: string;
  flag: FlagDesign;
  capital: number; // province index
  government: GovernmentId;
  tribal: boolean;
  alive: boolean;
  founded: GameDate;
  collapsed: GameDate | null;
  historical: boolean; // derived from historical dataset vs player-created
  origin: 'dataset' | 'player' | 'rebel' | 'scenario';
  ruler: Character;
  heir: Character | null;
  economy: Economy;
  food: FoodState;
  pop: PopulationStats;
  health: HealthState;
  tech: TechState;
  stability: StabilityState;
  military: MilitaryState;
  modifiers: Modifier[];
  ai: { personality: AIPersonality; goals: string[]; decisions: AIDecision[]; nextThink: number };
  overlord: CountryId | null;
  provinceCount: number;
  area: number;
  notes?: string;
}

export interface Province {
  id: number;
  name: string;
  modern: string;
  lon: number; lat: number; area: number;
  region: MacroRegion;
  coastal: boolean; river: boolean; desert: boolean; mountain: boolean;
  owner: CountryId | null;
  controller: CountryId | null;
  originalOwner: CountryId | null;
  pop: number;
  baseCap: number; // food carrying capacity at start
  dev: number; // 1..30
  roads: number; port: number; farms: number; market: number; buildings: number; fort: number; // 0..5
  unrest: number;
  siege: number; // 0..1 siege progress while enemy army present
}

export type TreatyType = 'alliance' | 'trade' | 'nap' | 'guarantee';
export interface Relation {
  opinion: number; // -200..200
  trust: number; // 0..100
  treaties: Partial<Record<TreatyType, { since: GameDate; until?: GameDate }>>;
  recognized: boolean;
  truceUntil: number; // month index
}

export interface BattleLog {
  date: GameDate; province: number; attacker: CountryId; defender: CountryId;
  winner: CountryId; aLoss: number; dLoss: number; factors: string[];
}
export interface War {
  id: string;
  name: string;
  attackers: CountryId[];
  defenders: CountryId[];
  start: GameDate;
  goal: 'conquest' | 'subjugation' | 'independence' | 'liberation';
  targetProvinces: number[];
  score: number; // -100..100 (positive favors attackers)
  battles: BattleLog[];
  ended: GameDate | null;
  result?: string;
}

export interface EventChoiceRecord { eventId: string; title: string; choice: string; country: CountryId; date: GameDate }
export interface PendingEvent {
  uid: string;
  eventId: string;
  country: CountryId;
  date: GameDate;
  title: string;
  body: string;
  options: { id: string; label: string; hint: string }[];
  data?: Record<string, number | string>;
  historical?: boolean;
}

export interface DiplomaticOffer {
  uid: string; from: CountryId; to: CountryId; kind: 'alliance' | 'trade' | 'nap' | 'peace' | 'vassalize' | 'independence';
  date: GameDate; terms?: { warId?: string; provinces?: number[]; type?: string }; reason: string;
}

export type TimelineKind =
  | 'start' | 'divergence' | 'war' | 'peace' | 'succession' | 'collapse' | 'founding' | 'event'
  | 'technology' | 'treaty' | 'rebellion' | 'disaster' | 'economy' | 'player' | 'historical';
export interface TimelineEntry {
  id: string;
  date: GameDate;
  kind: TimelineKind;
  title: string;
  text: string;
  countries: CountryId[];
  factual: boolean; // true only for documented history reproduced from scenario data
  importance: 1 | 2 | 3;
}

export interface LogEntry { date: GameDate; country?: CountryId; text: string; kind: string }

export interface CountrySnapshot { pop: number; gdp: number; provinces: number; stability: number; tech: number; military: number; treasury: number }
export interface YearSnapshot {
  year: number;
  countries: Record<CountryId, CountrySnapshot>;
  world: { pop: number; gdp: number; countries: number; wars: number };
}
export interface OwnershipSnapshot { year: number; owners: string } // compact encoded owner indices

export interface WorldSettings { difficulty: Difficulty; eventsFrequency: number; aiAggression: number; fogOfHistory: boolean }

export interface World {
  version: number;
  id: string;
  name: string;
  seed: number;
  rng: number;
  date: GameDate;
  startDate: GameDate;
  mapKey: string; // dataset key e.g. "1400"
  mode: 'scenario' | 'sandbox' | 'custom' | 'multiplayer';
  scenarioId: string | null;
  decisions: Record<string, string>; // scenario divergence choices
  provinces: Province[];
  countries: Record<CountryId, Country>;
  countryOrder: CountryId[];
  relations: Record<string, Relation>;
  wars: War[];
  events: {
    pending: PendingEvent[];
    fired: Record<string, number>; // eventKey -> month index last fired
    history: EventChoiceRecord[];
    scheduledDone: string[];
    custom: CustomEventDef[];
  };
  offers: DiplomaticOffer[];
  timeline: TimelineEntry[];
  log: LogEntry[];
  history: YearSnapshot[];
  ownership: OwnershipSnapshot[];
  player: CountryId | null;
  players: Record<string, CountryId>; // multiplayer slot -> country
  settings: WorldSettings;
  stats: { ticks: number; battles: number; eventsResolved: number; crisesSurvived: number; maxProvinces: number; stableMonths: number; peakGdp: number };
  achievements: string[];
  uidCounter: number;
}

// ---- Commands (player actions). Validated & applied by engine/commands.ts. ----
export type Command =
  | { type: 'setTax'; country: CountryId; rate: number }
  | { type: 'setBudget'; country: CountryId; budget: Budget; spendingRate: number }
  | { type: 'build'; country: CountryId; province: number; building: BuildingKind }
  | { type: 'research'; country: CountryId; tech: string }
  | { type: 'recruit'; country: CountryId; amount: number }
  | { type: 'disband'; country: CountryId; amount: number }
  | { type: 'doctrine'; country: CountryId; doctrine: MilitaryState['doctrine'] }
  | { type: 'loan'; country: CountryId; amount: number }
  | { type: 'repay'; country: CountryId; amount: number }
  | { type: 'buyFood'; country: CountryId; amount: number }
  | { type: 'diplo'; country: CountryId; target: CountryId; action: DiploAction; provinces?: number[] }
  | { type: 'eventChoice'; country: CountryId; uid: string; option: string }
  | { type: 'answerOffer'; country: CountryId; uid: string; accept: boolean }
  | { type: 'moveCapital'; country: CountryId; province: number }
  | { type: 'reform'; country: CountryId; government: GovernmentId }
  | { type: 'rename'; country: CountryId; name: string }
  | { type: 'colonize'; country: CountryId; province: number };

export type BuildingKind = 'roads' | 'port' | 'farms' | 'market' | 'buildings' | 'fort';
export type DiploAction =
  | 'improve' | 'insult' | 'alliance' | 'breakAlliance' | 'trade' | 'cancelTrade' | 'nap' | 'guarantee'
  | 'declareWar' | 'peaceWhite' | 'peaceDemand' | 'vassalize' | 'releaseVassal' | 'recognize' | 'gift';

export interface CommandResult { ok: boolean; message: string; evaluation?: AcceptanceBreakdown }
export interface AcceptanceBreakdown { total: number; threshold: number; factors: { label: string; value: number }[] }

// ---- Custom events (Scenario Editor) ----
export type ConditionStat = 'stability' | 'treasury' | 'population' | 'provinces' | 'atWar' | 'foodStock' | 'tech' | 'year' | 'relation';
export interface EventCondition { country: string; stat: ConditionStat; op: '<' | '>' | '=' ; value: number; other?: string }
export type EffectKind = 'treasury' | 'stability' | 'population' | 'foodStock' | 'research' | 'opinion' | 'war' | 'peace' | 'transferProvinces' | 'killRuler' | 'manpower';
export interface EventEffect { kind: EffectKind; country: string; value: number; other?: string }
export interface CustomEventDef {
  id: string;
  title: string;
  description: string;
  date?: GameDate; // fire on/after date
  probability: number; // monthly probability once conditions met (0..1); 1 with date = scheduled
  conditions: EventCondition[];
  options: { id: string; label: string; effects: EventEffect[] }[];
  once: boolean;
}

export interface ScenarioDecisionOption {
  id: string;
  label: string;
  description: string;
  historical?: boolean; // the documented outcome
}
export interface ScenarioDecision { id: string; question: string; context: string; options: ScenarioDecisionOption[]; dependsOn?: { decision: string; option: string } }

export interface ScenarioCharacter { name: string; role: string; years: string; bio: string; country: string }
export interface HistoricalTimelineEntry { date: GameDate; title: string; text: string; countries?: string[] }
export interface ScenarioDefinition {
  id: string;
  title: string;
  subtitle: string;
  question: string;
  mapKey: string;
  start: GameDate;
  era: EraId;
  background: string[];
  sourcesNote: string;
  sensitivity?: string; // educational/critical framing for atrocities & authoritarian regimes
  focusCountries: string[]; // polity names in dataset
  recommended: string; // polity name
  characters: ScenarioCharacter[];
  originalTimeline: HistoricalTimelineEntry[];
  decisions: ScenarioDecision[];
  consequences: { decision: string; option: string; text: string }[];
  custom?: boolean;
  author?: string;
  customEvents?: CustomEventDef[];
  artHue: number;
}

export interface MapStatic {
  key: string;
  adjacency: number[][]; // province -> neighbour provinces (land border)
  seaLinks: number[][]; // coastal province -> nearby coastal provinces (naval reach)
}
