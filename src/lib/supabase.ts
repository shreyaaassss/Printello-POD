import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Whether Supabase credentials are configured. Every screen in this app needs
 * them — unlike the DTF builder there is no useful offline mode — but we still
 * guard so a missing env var surfaces as a clear message rather than a crash.
 */
export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * Shared Supabase client. Placeholder values keep imports safe when the env is
 * unset; callers check `isSupabaseConfigured` before making network calls.
 */
export const supabase: SupabaseClient = createClient(
  url ?? 'http://localhost:54321',
  anonKey ?? 'public-anon-key',
  {
    auth: {
      // PKCE returns a single-use code rather than dropping access and refresh
      // tokens into the URL fragment, where they linger in browser history.
      flowType: 'pkce',
    },
  },
);
