import { EVENTS } from '../src/data/events.ts'

const errors: string[] = []
const ids = new Set<string>()
for (const e of EVENTS) {
  if (ids.has(e.id)) errors.push(`duplicate id ${e.id}`)
  ids.add(e.id)
  if (Math.abs(e.lat) > 90 || Math.abs(e.lng) > 180) errors.push(`${e.id}: bad coordinates`)
  if (e.verifiedFacts.length < 3) errors.push(`${e.id}: needs >= 3 verified facts`)
  if (e.pivot.alternatives.length < 2) errors.push(`${e.id}: needs >= 2 pivot alternatives`)
  if (e.scenarios.length < 1) errors.push(`${e.id}: needs a scenario`)
  if (!e.scenarios.some((s) => !s.premium)) errors.push(`${e.id}: needs at least one free scenario`)
  const sids = new Set<string>()
  for (const s of e.scenarios) {
    if (sids.has(s.id)) errors.push(`${e.id}: duplicate scenario ${s.id}`)
    sids.add(s.id)
    if (s.chapters.length < 3) errors.push(`${s.id}: needs >= 3 chapters`)
  }
  for (const r of e.related ?? []) if (!EVENTS.some((x) => x.id === r)) errors.push(`${e.id}: unknown related ${r}`)
}
if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log(`OK: ${EVENTS.length} events validated`)
