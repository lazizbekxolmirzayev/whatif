import type { CustomEventDef, ScenarioDefinition } from '../types/game';
import { idb } from './idb';
import { supabase } from './supabase';
import { useProfile } from './profile';
import { MAP_YEARS, SUPPORTED_RANGE } from '../data/eras';

export async function listCustom(): Promise<ScenarioDefinition[]> { return (await idb.all<ScenarioDefinition>('scenarios').catch(() => [])) ?? []; }
export async function getCustom(id: string): Promise<ScenarioDefinition | undefined> { return idb.get<ScenarioDefinition>('scenarios', id); }
export async function saveCustom(s: ScenarioDefinition): Promise<void> { await idb.set('scenarios', s.id, { ...s, custom: true }); }
export async function deleteCustom(id: string): Promise<void> { await idb.del('scenarios', id); }

/** Validation prevents invalid configurations from reaching the engine. */
export function validateScenario(s: ScenarioDefinition, polityNames: Set<string>): string[] {
  const errs: string[] = [];
  if (s.title.trim().length < 3) errs.push('Title must be at least 3 characters.');
  if (s.question.trim().length < 10) errs.push('Describe the "What if…?" question (10+ characters).');
  if (s.start.y < SUPPORTED_RANGE[0] || s.start.y > SUPPORTED_RANGE[1]) errs.push(`Start year must be between ${SUPPORTED_RANGE[0]} and ${SUPPORTED_RANGE[1]}.`);
  const ds = MAP_YEARS.find((m) => m.key === s.mapKey);
  if (!ds) errs.push('Unknown map dataset.');
  else if (ds.year > s.start.y) errs.push(`The map dataset (${ds.year}) is later than the start year.`);
  if (!s.focusCountries.length) errs.push('Select at least one country.');
  for (const c of s.focusCountries) if (polityNames.size && !polityNames.has(c)) errs.push(`"${c}" does not exist in the selected dataset.`);
  if (!s.recommended || !s.focusCountries.includes(s.recommended)) errs.push('Choose the player country from the selected countries.');
  const ids = new Set<string>();
  (s.customEvents ?? []).forEach((e: CustomEventDef, i) => {
    const n = `Event ${i + 1}`;
    if (ids.has(e.id)) errs.push(`${n}: duplicate id.`);
    ids.add(e.id);
    if (e.title.trim().length < 3) errs.push(`${n}: title required.`);
    if (e.probability <= 0 || e.probability > 1) errs.push(`${n}: probability must be between 0 and 1.`);
    if (!e.options.length) errs.push(`${n}: at least one outcome is required.`);
    if (e.date && (e.date.y * 12 + e.date.m) < s.start.y * 12 + s.start.m) errs.push(`${n}: date is before the scenario start.`);
    const known = new Set([...s.focusCountries, 'player']);
    for (const c of e.conditions) { if (c.stat !== 'year' && !known.has(c.country)) errs.push(`${n}: condition country "${c.country}" is not in the scenario.`); if (!Number.isFinite(c.value)) errs.push(`${n}: condition value invalid.`); }
    for (const o of e.options) for (const ef of o.effects) {
      if (!known.has(ef.country)) errs.push(`${n}: effect country "${ef.country}" is not in the scenario.`);
      if (['war', 'peace', 'opinion', 'transferProvinces'].includes(ef.kind) && (!ef.other || !known.has(ef.other))) errs.push(`${n}: "${ef.kind}" needs a valid second country.`);
      if (ef.kind === 'war' && ef.other === ef.country) errs.push(`${n}: a country cannot declare war on itself.`);
    }
  });
  return errs;
}

export function exportCode(s: ScenarioDefinition): string { return btoa(unescape(encodeURIComponent(JSON.stringify(s)))); }
export function importCode(code: string): ScenarioDefinition {
  const s = JSON.parse(decodeURIComponent(escape(atob(code.trim())))) as ScenarioDefinition;
  if (!s.id || !s.title || !s.mapKey || !s.start) throw new Error('Invalid scenario code.');
  return { ...s, id: `${s.id}-imp${Date.now().toString(36)}`, custom: true };
}

// ---- community sharing (Supabase table scenario_definitions, RLS: public rows readable by all) ----
export async function shareScenario(s: ScenarioDefinition): Promise<void> {
  const uid = useProfile.getState().userId;
  if (!supabase || !uid) throw new Error('Sign in (and configure Supabase) to share with the community. You can still share the export code.');
  const { error } = await supabase.from('scenario_definitions').upsert({ id: s.id, author_id: uid, title: s.title, question: s.question, start_year: s.start.y, map_key: s.mapKey, definition: s, is_public: true, updated_at: new Date().toISOString() });
  if (error) throw error;
}
export async function listCommunity(): Promise<ScenarioDefinition[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('scenario_definitions').select('definition, profiles(display_name)').eq('is_public', true).order('updated_at', { ascending: false }).limit(60);
  if (error) throw error;
  return (data ?? []).map((r) => ({ ...(r.definition as ScenarioDefinition), author: (r.profiles as unknown as { display_name?: string } | null)?.display_name ?? 'Community', custom: true }));
}
