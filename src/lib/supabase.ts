import { createClient } from '@supabase/supabase-js';

// Both values are public by design. Access control lives in the database (RLS + functions).
const SUPABASE_URL = 'https://rhkjzvexarivdlwqnxyf.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_PfIK1_3smo9mYMcZa5yUJQ_DcXAgKiC';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export type Season = { id: string; lock_at: string; playoff_lock_at: string | null };

export async function fetchCurrentSeason(): Promise<Season> {
  const { data, error } = await supabase
    .from('seasons')
    .select('id, lock_at, playoff_lock_at')
    .eq('is_current', true)
    .single();
  if (error) throw error;
  return data;
}

export function errorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String(e.message);
  return 'Something went wrong';
}
