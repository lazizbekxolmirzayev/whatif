// Generates supabase/seed.sql from the curated TypeScript data (run: npx vite-node scripts/gen-seed.ts)
import { writeFileSync } from 'node:fs';
import { CITIES } from '../../src/strategy/data/cities';
import { SCENARIOS } from '../../src/strategy/data/scenarios';
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const lines: string[] = ['-- AUTO-GENERATED reference data', 'begin;'];
for (const c of CITIES) lines.push(`insert into public.cities (id, lon, lat, founded, abandoned, names) values (${q(c.id)}, ${c.lon}, ${c.lat}, ${c.founded}, ${c.abandoned ?? 'null'}, ${q(JSON.stringify(c.names))}::jsonb) on conflict (id) do update set names = excluded.names;`);
for (const s of SCENARIOS) {
  lines.push(`insert into public.scenario_definitions (id, title, question, start_year, map_key, definition, is_public, is_builtin) values (${q(s.id)}, ${q(s.title)}, ${q(s.question)}, ${s.start.y}, ${q(s.mapKey)}, ${q(JSON.stringify(s))}::jsonb, true, true) on conflict (id) do update set definition = excluded.definition;`);
  for (const d of s.decisions) lines.push(`insert into public.scenario_decisions (scenario_id, decision_key, question, options, depends_on) values (${q(s.id)}, ${q(d.id)}, ${q(d.question)}, ${q(JSON.stringify(d.options))}::jsonb, ${d.dependsOn ? `${q(JSON.stringify(d.dependsOn))}::jsonb` : 'null'}) on conflict (scenario_id, decision_key) do nothing;`);
  for (const e of s.originalTimeline) lines.push(`insert into public.historical_events (scenario_id, year, month, title, description, countries, is_documented) values (${q(s.id)}, ${e.date.y}, ${e.date.m}, ${q(e.title)}, ${q(e.text)}, ${q(`{${(e.countries ?? []).map((x) => `"${x}"`).join(',')}}`)}, true);`);
}
lines.push('commit;');
writeFileSync('supabase/seed.sql', lines.join('\n') + '\n');
console.log(`seed.sql: ${lines.length} statements`);
