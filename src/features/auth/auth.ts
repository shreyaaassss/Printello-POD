import type { User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

/** Where Google returns the user. Must be allow-listed in Supabase Auth settings. */
export const AUTH_CALLBACK_PATH = '/auth/callback';

/** Where a signed-in user lands when no specific destination was requested. */
export const DEFAULT_SIGNED_IN_PATH = '/';

const NEXT_KEY = 'printello.pod.auth.next';

/** Reject anything that isn't a same-origin path, so `next` can't be an open redirect. */
function isSafePath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//');
}

/**
 * Start Google sign-in. This navigates away from the app, so nothing after it
 * runs on success; `next` is stashed in sessionStorage because the OAuth
 * round-trip returns to a fixed callback URL that carries no app state.
 */
export async function signInWithGoogle(next?: string): Promise<{ error: string | null }> {
  if (next && isSafePath(next)) {
    sessionStorage.setItem(NEXT_KEY, next);
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}${AUTH_CALLBACK_PATH}` },
  });
  return { error: error?.message ?? null };
}

/** Read and clear the stashed post-sign-in destination. */
export function takeNextPath(): string {
  const stored = sessionStorage.getItem(NEXT_KEY);
  sessionStorage.removeItem(NEXT_KEY);
  return stored && isSafePath(stored) ? stored : DEFAULT_SIGNED_IN_PATH;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/** Best-effort display name from the Google identity on the session. */
export function displayName(user: User): string {
  const meta = user.user_metadata ?? {};
  return (
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    user.email ||
    'Account'
  );
}

/** Google supplies the avatar under one of two keys depending on the scope granted. */
export function avatarUrl(user: User): string | null {
  const meta = user.user_metadata ?? {};
  if (typeof meta.avatar_url === 'string') return meta.avatar_url;
  if (typeof meta.picture === 'string') return meta.picture;
  return null;
}

export function initials(user: User): string {
  const name = displayName(user).trim();
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
