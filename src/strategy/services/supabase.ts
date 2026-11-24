import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Only the public anon key is used in the browser; all privileged work happens in
// Row-Level-Security-protected tables and Edge Functions.
// Next.js inlines NEXT_PUBLIC_* variables at build time (formerly VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || undefined;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || undefined;
export const supabase: SupabaseClient | null = url && key ? createClient(url, key, { auth: { persistSession: true } }) : null;
export const cloudEnabled = !!supabase;
