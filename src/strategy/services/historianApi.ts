import type { CountryId, World } from '../types/game';
import { supabase } from './supabase';
import { buildContext } from '../engine/historian';

/** The LLM call happens ONLY inside a Supabase Edge Function holding the API key server-side. */
export function llmAvailable(): boolean { return !!supabase && process.env.NEXT_PUBLIC_ENABLE_AI_HISTORIAN === 'true'; }

export async function askLLM(w: World, question: string, focus: CountryId | null): Promise<string> {
  if (!supabase) throw new Error('not configured');
  const context = buildContext(w, focus);
  const { data, error } = await supabase.functions.invoke('ai-historian', { body: { question: question.slice(0, 600), context } });
  if (error) throw error;
  if (!data?.answer) throw new Error('empty answer');
  return String(data.answer);
}
