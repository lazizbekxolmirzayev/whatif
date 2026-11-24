import type { Scenario } from '../types.ts'
import { ANKARA_1402 } from './ankara1402.ts'

export const SCENARIOS: Scenario[] = [ANKARA_1402]
export const getScenario = (id: string) => SCENARIOS.find((s) => s.id === id)
