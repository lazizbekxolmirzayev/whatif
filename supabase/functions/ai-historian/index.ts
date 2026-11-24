// AI Historian — calls the language model server-side. The API key never reaches the browser.
// Secrets: ANTHROPIC_API_KEY (required), HISTORIAN_MODEL (optional).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { cors, json } from '../_shared/cors.ts';

const SYSTEM = `You are the AI Historian of the alternative-history strategy game "WHAT IF?".
Rules:
- Answer ONLY from the SIMULATION CONTEXT provided plus well-established real history for background.
- Never invent game events, numbers, wars or people that are not in the context. If the data does not answer the question, say so.
- Timeline entries marked factual=false are simulated alternative history: always describe them as "in this timeline", never as real history.
- Treat authoritarian regimes, wars and atrocities critically and educationally; never glorify them.
- Be concise (max ~250 words), cite the numbers you use, and end with one sentence on what the player could watch or do next.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const key = Deno.env.get('ANTHROPIC_API_KEY');
    if (!key) return json({ error: 'AI historian not configured' }, 503);
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
    const { data: { user } } = await sb.auth.getUser(token);
    if (!user) return json({ error: 'Sign in to use the AI historian' }, 401);
    const { data: allowed } = await sb.rpc('check_rate_limit', { p_user: user.id, p_action: 'historian', p_max: 30, p_window_seconds: 3600 });
    if (!allowed) return json({ error: 'Rate limit reached (30 questions per hour)' }, 429);
    const body = await req.json();
    const question = String(body.question ?? '').slice(0, 600);
    const context = String(body.context ?? '').slice(0, 12000);
    if (question.length < 3) return json({ error: 'Question too short' }, 400);
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: Deno.env.get('HISTORIAN_MODEL') ?? 'claude-sonnet-5-5', max_tokens: 700, system: SYSTEM, messages: [{ role: 'user', content: `SIMULATION CONTEXT:\n${context}\n\nQUESTION: ${question}` }] }),
    });
    if (!r.ok) return json({ error: `Model error ${r.status}` }, 502);
    const data = await r.json();
    const answer = (data.content ?? []).filter((c: { type: string }) => c.type === 'text').map((c: { text: string }) => c.text).join('\n');
    return json({ answer });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
