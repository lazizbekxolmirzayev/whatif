import { supabase } from './supabase';
import { syncProfile, useProfile } from './profile';

export async function initAuth(): Promise<void> {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  apply(data.session?.user ?? null);
  supabase.auth.onAuthStateChange((_e, session) => apply(session?.user ?? null));
}
function apply(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | null) {
  const set = useProfile.getState().setIdentity;
  if (!user) { set({ userId: null, email: null }); return; }
  set({ userId: user.id, email: user.email ?? null, displayName: (user.user_metadata?.display_name as string) ?? useProfile.getState().displayName });
  void syncProfile();
}
export async function signUp(email: string, password: string, displayName: string) {
  if (!supabase) throw new Error('Cloud accounts are not configured (set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY).');
  const { error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: displayName } } });
  if (error) throw error;
}
export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error('Cloud accounts are not configured.');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}
export async function signOut() { if (supabase) await supabase.auth.signOut(); useProfile.getState().setIdentity({ userId: null, email: null }); }
